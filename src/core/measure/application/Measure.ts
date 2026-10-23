import {
  SnapshotSource,
  TakenSnapshot,
} from '@/core/snapshot/domain/SnapshotSource.ts';
import {
  VoteInclusionTracker,
  bankSlotOf,
} from '@/core/snapshot/domain/VoteInclusionTracker.ts';
import { Network } from '@/core/snapshot/domain/Network.ts';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import {
  REWARD_BUDGET_ADDRESS,
  halfLeaderReward,
  rewardBudgetFor,
} from '@/core/measure/domain/RewardBudget.ts';
import { computeEpochRatios } from '@/core/measure/domain/EpochRatio.ts';
import { BlockProduction } from '@/core/solana/SolanaRpc.ts';
import {
  EpochRatio,
  InclusionStatus,
  InclusionTotals,
  InclusionWindow,
  MeasureResponse,
  SnapshotExtras,
  SnapshotMeta,
  ValidatorExtras,
} from '@/types/measure.ts';

export interface MeasureRpc {
  blockProduction(firstSlot: number, lastSlot: number): Promise<BlockProduction>;
  slotLeaders(startSlot: number, limit: number): Promise<string[]>;
  accountData(address: string): Promise<Uint8Array | null>;
}

export type MeasureDeps = {
  source: SnapshotSource;
  rpc: MeasureRpc;
  tracker: VoteInclusionTracker;
  network: Network;
  instance: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const PENDING: EpochRatio = { value: null, state: 'pending' };

// Not measured validators (spec §6.4: grey, never a miss). The tracker
// counts D = 0 as a measured k = 0 even below û = 100, and keeps the k = 0
// windows of a validator that stopped voting before it went delinquent, so
// its numbers would read as 0% and misses: no totals (the table counts 0 of
// 0), no offline run, and their windows are shown as not measured.
const WITHOUT_NUMBERS = new Set<InclusionStatus>([
  'not_measurable',
  'delinquent',
]);

// Keeps the window's seq, slots and paying blocks, as the tracker's own
// not measured windows do.
const notMeasured = (w: InclusionWindow): InclusionWindow => ({
  ...w,
  kind: 'not_measured',
  included: 0,
  shared: false,
});

const logFailure = (what: string) => (error: unknown) =>
  console.error(`vote inclusion: ${what} failed`, error);

// On-demand measurement (spec §4.1): feeds the tracker from the shared
// snapshot cache, refreshes the epoch ratio every minute and runs the
// learning burst. One per process, state in memory.
export class MeasureService {
  private readonly _now: () => number;
  private readonly _sleep: (ms: number) => Promise<void>;
  private _lastMeasureAt = -Infinity;
  private _ingestedSeq = 0;
  private _queue: Promise<void> = Promise.resolve();
  private _ratios = new Map<string, EpochRatio>();
  private _ratiosEpoch: number | null = null;
  private _ratiosAt = -Infinity;
  private _ratioRun: Promise<void> | null = null;
  private _burstRun: Promise<void> | null = null;
  private _burstAt = -Infinity;
  private _burstEpoch: number | null = null;

  constructor(private readonly _deps: MeasureDeps) {
    this._now = _deps.now ?? Date.now;
    this._sleep =
      _deps.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get instance(): string {
    return this._deps.instance;
  }

  // Someone is measuring: a measure request in the last 20 s.
  isMeasuring(): boolean {
    return this._now() - this._lastMeasureAt <= MEASURE.measuringWindowMs;
  }

  async measure(vote: string): Promise<MeasureResponse> {
    this._lastMeasureAt = this._now();
    await this._fresh(MEASURE.snapshotTtlMs);
    this.kick();
    return this._view(vote);
  }

  tableExtras(): SnapshotExtras {
    this.kick();
    const now = this._now();
    const { tracker, network } = this._deps;
    const migrationEpoch =
      tracker.epoch !== null && network.isMigrationEpoch(tracker.epoch);
    const measurement = tracker.measurement(now);
    const hidden = migrationEpoch || measurement === 'under_review';
    const measuring = this.isMeasuring();
    const showInclusion = measuring && !hidden;
    const meta: SnapshotMeta = {
      instance: this.instance,
      epoch: tracker.epoch,
      migrationEpoch,
      measurement,
      measuring,
      minMeasurableStake: this._minMeasurableStake(),
      ...(showInclusion
        ? {
            inclusionCoverageSeconds: tracker.coverageSeconds(now),
            cluster: tracker.cluster(now),
          }
        : {}),
    };
    return {
      meta,
      byVote: (vote: string): ValidatorExtras => {
        const extras = this._ratioFor(vote, migrationEpoch, hidden);
        const status = showInclusion ? tracker.status(vote, now) : null;
        if (status === null) {
          return extras;
        }
        // No measured window in the last 5 minutes (Not measurable,
        // Delinquent, or none yet): 0 of 0 paying blocks, shown as "—".
        const totals = this._last5m(vote, status, now);
        return {
          ...extras,
          inclusion: {
            status,
            included: totals?.included ?? 0,
            payable: totals?.payable ?? 0,
            missed: totals?.missed ?? 0,
          },
        };
      },
    };
  }

  // Background work: ingest the newest cached snapshot, refresh the epoch
  // ratio every minute, start a learning burst when units are missing.
  kick(): void {
    const latest = this._deps.source.latest();
    if (latest) {
      this._serial(() => this._ingest(latest)).catch(logFailure('ingest'));
    }
    if (
      !this._ratioRun &&
      this._now() - this._ratiosAt >= MEASURE.epochRatioRefreshMs
    ) {
      this._ratiosAt = this._now();
      this._ratioRun = this._refreshRatios()
        .catch(logFailure('epoch ratio'))
        .finally(() => {
          this._ratioRun = null;
        });
    }
    if (!this._burstRun && this._burstDue()) {
      // Set before the first snapshot: a burst that fails is a retry.
      this._burstAt = this._now();
      this._burstEpoch = this._deps.tracker.epoch;
      this._burstRun = this._burst()
        .catch(logFailure('learning burst'))
        .finally(() => {
          this._burstRun = null;
          this.kick();
        });
    }
  }

  // Resolves when the background work started so far has finished.
  async idle(): Promise<void> {
    while (this._ratioRun || this._burstRun) {
      await Promise.all([this._ratioRun, this._burstRun]);
    }
    await this._queue;
  }

  private _serial(task: () => Promise<void>): Promise<void> {
    const run = this._queue.then(task);
    this._queue = run.catch(() => undefined);
    return run;
  }

  // A snapshot younger than maxAgeMs, fed to the tracker once.
  private async _fresh(maxAgeMs: number): Promise<TakenSnapshot> {
    const taken = await this._deps.source.get(maxAgeMs);
    await this._serial(() => this._ingest(taken));
    return taken;
  }

  private async _ingest(taken: TakenSnapshot): Promise<void> {
    if (taken.seq <= this._ingestedSeq) {
      return;
    }
    this._ingestedSeq = taken.seq;
    const bankSlot = bankSlotOf(taken.snapshot);
    if (bankSlot !== null) {
      await this._ensureBudget(this._deps.network.epochOf(bankSlot));
    }
    this._deps.tracker.ingest(
      taken.snapshot,
      taken.takenAt,
      this.isMeasuring()
    );
  }

  // The account is rewritten in the first block of each epoch; until it
  // matches, every new snapshot reads it again (spec §3).
  private async _ensureBudget(epoch: number): Promise<void> {
    const tracker = this._deps.tracker;
    if (!tracker.needsBudget(epoch)) {
      return;
    }
    try {
      const data = await this._deps.rpc.accountData(REWARD_BUDGET_ADDRESS);
      const budget = data ? rewardBudgetFor(data, epoch) : null;
      if (budget) {
        tracker.setBudget(budget);
      }
    } catch (error) {
      logFailure('reward budget read')(error);
    }
  }

  // First burst of an epoch while below 99%; then at most every 10 minutes
  // while below 98% (spec §4.5). kick() records the epoch when a burst
  // starts, so one that fails (CLI down) waits 10 minutes instead of being
  // restarted at once; before any burst, _burstAt = -Infinity makes it due.
  private _burstDue(): boolean {
    const { tracker, network } = this._deps;
    const epoch = tracker.epoch;
    if (epoch !== null && network.isMigrationEpoch(epoch)) {
      return false;
    }
    const confirmed = tracker.confirmedShare();
    if (this._burstEpoch !== epoch) {
      return confirmed < MEASURE.burstTargetShare;
    }
    return (
      confirmed < MEASURE.burstRetryBelowShare &&
      this._now() - this._burstAt >= MEASURE.burstRetryMs
    );
  }

  // Snapshots 5 s apart until 99% of the measurable stake has a confirmed
  // unit, at most 8. Its windows are published only if someone measures.
  private async _burst(): Promise<void> {
    const { tracker, network } = this._deps;
    for (let i = 0; i < MEASURE.burstMaxSnapshots; i++) {
      if (i > 0) {
        await this._sleep(MEASURE.burstIntervalMs);
      }
      await this._fresh(MEASURE.burstIntervalMs / 2);
      this._burstEpoch = tracker.epoch;
      if (tracker.epoch !== null && network.isMigrationEpoch(tracker.epoch)) {
        return;
      }
      if (tracker.confirmedShare() >= MEASURE.burstTargetShare) {
        break;
      }
    }
    // New units: refresh the epoch ratio on the next kick.
    this._ratiosAt = -Infinity;
  }

  // C and block production from the same slot (spec §5.2, alignment).
  private async _refreshRatios(): Promise<void> {
    const { tracker, network, rpc } = this._deps;
    const taken = await this._fresh(MEASURE.snapshotTtlMs);
    const bankSlot = bankSlotOf(taken.snapshot);
    if (bankSlot === null) {
      return;
    }
    const epoch = network.epochOf(bankSlot);
    if (this._ratiosEpoch !== epoch) {
      this._ratios = new Map();
      this._ratiosEpoch = epoch;
    }
    const budget = tracker.budget();
    if (
      network.isMigrationEpoch(epoch) ||
      tracker.epoch !== epoch ||
      !budget ||
      budget.epoch !== epoch
    ) {
      return;
    }
    const [production, leaders] = await Promise.all([
      rpc.blockProduction(network.firstSlot(epoch), bankSlot),
      rpc.slotLeaders(
        bankSlot - MEASURE.leaderGuardBefore,
        MEASURE.leaderGuardBefore + MEASURE.leaderGuardAfter + 1
      ),
    ]);
    let blocks = 0;
    const leaderSlots: Record<string, number> = {};
    for (const [identity, [slots, produced]] of Object.entries(
      production.byIdentity
    )) {
      leaderSlots[identity] = slots;
      blocks += produced;
    }
    this._ratios = computeEpochRatios({
      snapshot: taken.snapshot,
      blocksProduced: blocks,
      leaderSlots,
      nearLeaders: new Set(leaders),
      halfLeaderReward: halfLeaderReward(budget),
      unitOf: (vote) => tracker.confirmedUnit(vote),
      estimateOf: (vote) => tracker.estimate(vote),
      previous: this._ratios,
    });
  }

  private _last5m(
    vote: string,
    status: InclusionStatus,
    now: number
  ): InclusionTotals | null {
    return WITHOUT_NUMBERS.has(status)
      ? null
      : this._deps.tracker.last5m(vote, now);
  }

  private _recent(
    vote: string,
    status: InclusionStatus,
    now: number
  ): InclusionWindow[] {
    const windows = this._deps.tracker.recent(vote, now);
    return WITHOUT_NUMBERS.has(status) ? windows.map(notMeasured) : windows;
  }

  private _minMeasurableStake(): string | null {
    return this._deps.tracker.minMeasurableStake()?.toString() ?? null;
  }

  private _ratioFor(
    vote: string,
    migrationEpoch: boolean,
    hidden: boolean
  ): ValidatorExtras {
    if (migrationEpoch) {
      return { epochRatio: null, epochRatioState: 'unavailable' };
    }
    const current = this._ratiosEpoch === this._deps.tracker.epoch;
    const ratio = !hidden && current ? this._ratios.get(vote) ?? PENDING : PENDING;
    return { epochRatio: ratio.value, epochRatioState: ratio.state };
  }

  private _view(vote: string): MeasureResponse {
    const now = this._now();
    const { tracker, network } = this._deps;
    const epoch = tracker.epoch ?? 0;
    const migrationEpoch = network.isMigrationEpoch(epoch);
    const measurement = tracker.measurement(now);
    const hidden = migrationEpoch || measurement === 'under_review';
    const status = tracker.status(vote, now);
    return {
      instance: this.instance,
      epoch,
      migrationEpoch,
      measurement,
      minMeasurableStake: this._minMeasurableStake(),
      coverageSeconds: hidden ? 0 : tracker.coverageSeconds(now),
      cluster: hidden ? null : tracker.cluster(now),
      validator:
        status === null
          ? null
          : {
              votePubkey: vote,
              // Hidden, the statuses that rest on P read Measuring. Not
              // measurable (û, from the stake) and Delinquent (the CLI
              // flag) do not rest on it, so they stay.
              status:
                hidden && !WITHOUT_NUMBERS.has(status) ? 'measuring' : status,
              last5m: hidden ? null : this._last5m(vote, status, now),
              // Paying blocks without the vote are misses: hidden under
              // review (spec §4.8) and for the not measured statuses.
              offlineRun:
                hidden || WITHOUT_NUMBERS.has(status)
                  ? 0
                  : tracker.offlineRun(vote),
              ...this._ratioFor(vote, migrationEpoch, hidden),
              recent: hidden ? [] : this._recent(vote, status, now),
            },
    };
  }
}
