import { Snapshot, ValidatorSnapshot } from '@/types/snapshot.ts';
import {
  ClusterView,
  InclusionStatus,
  InclusionTotals,
  InclusionWindow,
  MeasurementHealth,
  WindowKind,
} from '@/types/measure.ts';
import { Network } from '@/core/snapshot/domain/Network.ts';
import { MEASURE } from '@/core/measure/domain/Constants.ts';
import {
  RewardBudget,
  approximateUnit,
} from '@/core/measure/domain/RewardBudget.ts';

export type SkipReason =
  | 'no_slot'
  | 'same_slot'
  | 'first'
  | 'epoch_change'
  | 'gap'
  | 'migration'
  | 'epoch_start'
  | 'budget'
  | 'backends';

export type IngestResult =
  | { kind: 'skipped'; reason: SkipReason }
  | { kind: 'window'; payable: number | null; published: boolean };

type Point = {
  takenAt: number;
  bankSlot: number;
  epoch: number;
  byVote: Map<string, ValidatorSnapshot>;
};

type Measured = { votes: string[]; stake: bigint; confirmedStake: bigint };

type Unit = {
  confirmed: number | null;
  // The latest candidate D/P and the gcd of the P values that gave it.
  candidate: { value: number; payableGcd: number } | null;
};

type WindowResult = Pick<
  InclusionWindow,
  'kind' | 'included' | 'payable' | 'shared'
>;

type StoredWindow = InclusionWindow & { takenAt: number };

type PublishedWindow = {
  takenAt: number;
  durationMs: number;
  cluster: ClusterView | null;
};

const skip = (reason: SkipReason): IngestResult => ({
  kind: 'skipped',
  reason,
});

const notMeasured = (payable: number): WindowResult => ({
  kind: 'not_measured',
  included: 0,
  payable,
  shared: false,
});

const stakeOf = (v: ValidatorSnapshot): bigint => BigInt(v.activatedStake);

const share = (part: bigint, total: bigint): number =>
  total > 0n ? Number(part) / Number(total) : 0;

function gcd(x: number, y: number): number {
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)];
}

function toWindow(w: StoredWindow): InclusionWindow {
  return {
    seq: w.seq,
    fromSlot: w.fromSlot,
    toSlot: w.toSlot,
    kind: w.kind,
    included: w.included,
    payable: w.payable,
    shared: w.shared,
  };
}

// bankSlot = max(lastVote of non-delinquent validators) + 1 (spec §4.2).
export function bankSlotOf(snapshot: Snapshot): number | null {
  let max = -1;
  for (const v of snapshot.validators) {
    if (!v.delinquent && v.lastVote > max) {
      max = v.lastVote;
    }
  }
  return max < 0 ? null : max + 1;
}

// Votes counted under Alpenglow (spec §4.2-4.8). Turns consecutive
// `solana validators` snapshots into windows of paying blocks and learns each
// validator's exact reward per block. Pure: the caller feeds the snapshots
// and the reward budget.
export class VoteInclusionTracker {
  private _epoch: number | null = null;
  private _budget: RewardBudget | null = null;
  private _prev: Point | null = null;
  private _latest: Point | null = null;
  private _estimates = new Map<string, number>();
  private _stakeEstimateBase = 0n;
  private _units = new Map<string, Unit>();
  private _windows = new Map<string, StoredWindow[]>();
  private _published: PublishedWindow[] = [];
  private _offline = new Map<string, number>();
  private _sanity: boolean[] = [];
  private _firstWindowAt: number | null = null;
  private _seq = 0;

  constructor(private readonly _network: Network) {}

  get epoch(): number | null {
    return this._epoch;
  }

  budget(): RewardBudget | null {
    return this._budget;
  }

  // The tracker never goes back to an older epoch (ingest ignores snapshots
  // of an older bank), so it never needs, nor takes, an older budget.
  needsBudget(epoch: number): boolean {
    if (this._epoch !== null && epoch < this._epoch) {
      return false;
    }
    return this._budget?.epoch !== epoch;
  }

  setBudget(budget: RewardBudget): void {
    if (this._epoch !== null && budget.epoch < this._epoch) {
      return;
    }
    this._budget = budget;
    if (this._latest) {
      this._estimate(this._latest);
    }
  }

  ingest(snapshot: Snapshot, takenAt: number, publish: boolean): IngestResult {
    const bankSlot = bankSlotOf(snapshot);
    if (bankSlot === null) {
      return skip('no_slot');
    }
    const a = this._prev;
    if (a && a.bankSlot === bankSlot) {
      return skip('same_slot');
    }
    if (a && bankSlot < a.bankSlot) {
      // An older bank from an RPC backend that lags behind (spec §10). Its
      // credits are lower, so the median D would read as an epoch change and
      // wipe the epoch's units. Keep `a`: the next window starts from it.
      return skip('backends');
    }

    const b: Point = {
      takenAt,
      bankSlot,
      epoch: this._network.epochOf(bankSlot),
      byVote: new Map(snapshot.validators.map((v) => [v.voteAccountPubkey, v])),
    };
    this._prev = b;
    this._latest = b;

    if (this._epoch !== b.epoch) {
      this._resetEpoch(b.epoch);
      this._estimate(b);
      return skip(a ? 'epoch_change' : 'first');
    }
    this._estimate(b);
    if (!a) {
      return skip('first');
    }

    const deltas = this._deltas(a, b);
    if (median([...deltas.values()]) < 0) {
      // The CLI already reads the next epoch's counter.
      this._resetEpoch(b.epoch);
      this._estimate(b);
      return skip('epoch_change');
    }
    // Spec §4.7: a window with D > 0 resets the offline run, also when it is
    // discarded (a gap) or not published (nobody measuring, a burst).
    this._resetOfflineRuns(deltas);
    if (b.takenAt - a.takenAt > MEASURE.maxWindowGapMs) {
      return skip('gap');
    }
    if (this._network.isMigrationEpoch(b.epoch)) {
      return skip('migration');
    }
    if (
      a.bankSlot <
      this._network.firstSlot(b.epoch) + MEASURE.firstSlotsSkipped
    ) {
      return skip('epoch_start');
    }
    if (this.needsBudget(b.epoch)) {
      return skip('budget');
    }
    let negatives = 0;
    for (const delta of deltas.values()) {
      if (delta < 0) {
        negatives += 1;
      }
    }
    if (negatives > MEASURE.maxNegativeShare * deltas.size) {
      return skip('backends');
    }

    return this._window(a, b, deltas, publish);
  }

  confirmedUnit(vote: string): number | null {
    return this._units.get(vote)?.confirmed ?? null;
  }

  // Smallest stake with û ≥ 100 under the current budget and S′, for the
  // "Not measurable" texts (spec §6.6): û ≥ m ⇔ s ≥ 2·m·N·S′ / Budget.
  minMeasurableStake(): bigint | null {
    const budget = this._budget;
    if (!budget || this._stakeEstimateBase <= 0n || budget.budget <= 0n) {
      return null;
    }
    const numerator =
      2n *
      BigInt(MEASURE.minUnitEstimate) *
      budget.slotsPerEpoch *
      this._stakeEstimateBase;
    return (numerator + budget.budget - 1n) / budget.budget;
  }

  estimate(vote: string): number | null {
    return this._estimates.get(vote) ?? null;
  }

  offlineRun(vote: string): number {
    return this._offline.get(vote) ?? 0;
  }

  recent(vote: string, now: number): InclusionWindow[] {
    return this._recentWindows(vote, now).map(toWindow);
  }

  last5m(vote: string, now: number): InclusionTotals | null {
    const measured = this._recentWindows(vote, now).filter(
      (w) => w.kind === 'measured'
    );
    if (measured.length === 0) {
      return null;
    }
    let included = 0;
    let payable = 0;
    let sharedMissed = 0;
    for (const w of measured) {
      included += w.included;
      payable += w.payable;
      if (w.shared) {
        sharedMissed += w.payable - w.included;
      }
    }
    return { included, payable, missed: payable - included, sharedMissed };
  }

  coverageSeconds(now: number): number {
    const since = now - MEASURE.recentWindowMs;
    const ms = this._published
      .filter((p) => p.takenAt > since)
      .reduce((sum, p) => sum + p.durationMs, 0);
    return Math.round(ms / 1000);
  }

  cluster(now: number): ClusterView | null {
    const last = this._published[this._published.length - 1];
    return last && last.takenAt > now - MEASURE.recentWindowMs
      ? last.cluster
      : null;
  }

  // Share of the measurable stake (non-delinquent, û ≥ 100) of the latest
  // snapshot that has a confirmed unit.
  confirmedShare(): number {
    if (!this._latest) {
      return 0;
    }
    let total = 0n;
    let confirmed = 0n;
    for (const [vote, v] of this._latest.byVote) {
      if (
        v.delinquent ||
        (this._estimates.get(vote) ?? 0) < MEASURE.minUnitEstimate
      ) {
        continue;
      }
      total += stakeOf(v);
      if (this.confirmedUnit(vote) !== null) {
        confirmed += stakeOf(v);
      }
    }
    return share(confirmed, total);
  }

  // Spec §4.8, in order. Not voting also needs a confirmed unit (spec §8):
  // a validator outside the epoch's paid set has D = 0 while it votes.
  status(vote: string, now: number): InclusionStatus | null {
    const v = this._latest?.byVote.get(vote);
    if (!v) {
      return null;
    }
    if (v.delinquent) {
      return 'delinquent';
    }
    const estimate = this._estimates.get(vote);
    if (estimate === undefined) {
      return 'measuring';
    }
    if (estimate < MEASURE.minUnitEstimate) {
      return 'not_measurable';
    }
    if (
      this.offlineRun(vote) >= MEASURE.notVotingBlocks &&
      this.confirmedUnit(vote) !== null
    ) {
      return 'not_voting';
    }
    const totals = this.last5m(vote, now);
    if (
      this.confirmedUnit(vote) === null ||
      !totals ||
      totals.payable < MEASURE.measuringMinPayable
    ) {
      return 'measuring';
    }
    if (
      (totals.included + totals.sharedMissed) / totals.payable <
      MEASURE.okInclusion
    ) {
      return 'missing';
    }
    return 'ok';
  }

  measurement(now: number): MeasurementHealth {
    const unitsLate =
      this._firstWindowAt !== null &&
      now - this._firstWindowAt >= MEASURE.reviewAfterMs &&
      this.confirmedShare() < MEASURE.reviewMinConfirmedShare;
    const failures = this._sanity.filter((ok) => !ok).length;
    const payableOff =
      failures > MEASURE.reviewSanityWindows * MEASURE.reviewSanityFailShare;
    return unitsLate || payableOff ? 'under_review' : 'ok';
  }

  private _resetEpoch(epoch: number): void {
    this._epoch = epoch;
    this._units.clear();
    this._windows.clear();
    this._published = [];
    this._offline.clear();
    this._sanity = [];
    this._firstWindowAt = null;
  }

  // û of every validator of b (spec §4.3), with S′ = stake of the validators
  // that earned something this epoch, delinquent or not. S′ stands for the
  // epoch's stake set, and a validator that went delinquent is still in it:
  // leaving its stake out would raise every û by 1 / (1 − d) and shift the
  // bootstrap P (P = 19 for 20 blocks with 4% of the stake delinquent).
  private _estimate(b: Point): void {
    this._estimates.clear();
    this._stakeEstimateBase = 0n;
    const budget = this._budget;
    if (!budget || budget.epoch !== b.epoch) {
      return;
    }
    let total = 0n;
    for (const v of b.byVote.values()) {
      if (v.epochCredits > 0) {
        total += stakeOf(v);
      }
    }
    this._stakeEstimateBase = total;
    for (const [vote, v] of b.byVote) {
      this._estimates.set(vote, approximateUnit(budget, stakeOf(v), total));
    }
  }

  private _deltas(a: Point, b: Point): Map<string, number> {
    const deltas = new Map<string, number>();
    for (const [vote, vb] of b.byVote) {
      const va = a.byVote.get(vote);
      if (va) {
        deltas.set(vote, vb.epochCredits - va.epochCredits);
      }
    }
    return deltas;
  }

  private _window(
    a: Point,
    b: Point,
    deltas: Map<string, number>,
    publish: boolean
  ): IngestResult {
    if (this._firstWindowAt === null) {
      this._firstWindowAt = b.takenAt;
    }
    const measured = this._measured(a, b, deltas);
    const payable = this._payable(b, measured, deltas);
    const sane =
      payable !== null &&
      payable <= b.bankSlot - a.bankSlot + MEASURE.payableSlack;
    this._sanity = [...this._sanity, sane].slice(-MEASURE.reviewSanityWindows);

    if (payable === null || !sane) {
      if (publish) {
        this._publishUnmeasured(a, b);
      }
      return { kind: 'window', payable: null, published: publish };
    }

    this._learnUnits(a, b, deltas, payable);
    if (publish) {
      this._publish(a, b, deltas, payable, measured);
    }
    return { kind: 'window', payable, published: publish };
  }

  // Present in both snapshots, not delinquent, û ≥ 100 (spec §4.4).
  private _measured(
    a: Point,
    b: Point,
    deltas: Map<string, number>
  ): Measured {
    const measured: Measured = { votes: [], stake: 0n, confirmedStake: 0n };
    for (const vote of deltas.keys()) {
      const vb = b.byVote.get(vote);
      const va = a.byVote.get(vote);
      if (!vb || !va || vb.delinquent || va.delinquent) {
        continue;
      }
      if ((this._estimates.get(vote) ?? 0) < MEASURE.minUnitEstimate) {
        continue;
      }
      measured.votes.push(vote);
      measured.stake += stakeOf(vb);
      if (this.confirmedUnit(vote) !== null) {
        measured.confirmedStake += stakeOf(vb);
      }
    }
    return measured;
  }

  // P (spec §4.4). Bootstrap: the integer nearest to D/û with the most stake.
  // Normal: the largest exact count D/u held by at least 5% of the measured
  // stake, so a thin block does not lower it.
  private _payable(
    b: Point,
    measured: Measured,
    deltas: Map<string, number>
  ): number | null {
    const bootstrap =
      share(measured.confirmedStake, measured.stake) <
      MEASURE.bootstrapBelowConfirmedShare;
    const stakeByCount = new Map<number, bigint>();
    for (const vote of measured.votes) {
      const delta = deltas.get(vote) ?? -1;
      const v = b.byVote.get(vote);
      if (delta < 0 || !v) {
        continue;
      }
      const count = bootstrap
        ? this._nearCount(vote, delta)
        : this._exactCount(vote, delta);
      if (count !== null) {
        stakeByCount.set(count, (stakeByCount.get(count) ?? 0n) + stakeOf(v));
      }
    }

    let payable: number | null = null;
    let best = 0n;
    for (const [count, stake] of stakeByCount) {
      if (bootstrap) {
        if (stake > best) {
          payable = count;
          best = stake;
        }
      } else if (
        share(stake, measured.stake) >= MEASURE.recordMinStakeShare &&
        (payable === null || count > payable)
      ) {
        payable = count;
      }
    }
    return payable;
  }

  private _nearCount(vote: string, delta: number): number | null {
    const estimate = this._estimates.get(vote) ?? 0;
    const ratio = delta / estimate;
    const count = Math.round(ratio);
    return Math.abs(ratio - count) <= MEASURE.bootstrapTolerance
      ? count
      : null;
  }

  private _exactCount(vote: string, delta: number): number | null {
    const unit = this.confirmedUnit(vote);
    return unit !== null && delta % unit === 0 ? delta / unit : null;
  }

  // Exact units (spec §4.5): a candidate D/P from a window where the
  // validator was in every paying block, confirmed by windows with other P;
  // demoted when it stops dividing a leader-free delta.
  //
  // A validator that misses the same share m/P of the blocks in two windows
  // gives the same wrong candidate u·(1 − m/P) twice (P = 20 missing 1 and
  // P = 40 missing 2). Every such P is a multiple of the denominator of m/P,
  // so the candidate is confirmed only once the gcd of its P values is 1.
  private _learnUnits(
    a: Point,
    b: Point,
    deltas: Map<string, number>,
    payable: number
  ): void {
    for (const [vote, delta] of deltas) {
      if (
        delta <= 0 ||
        b.byVote.get(vote)?.delinquent ||
        a.byVote.get(vote)?.delinquent
      ) {
        continue;
      }
      const unit = this._unitOf(vote);
      if (unit.confirmed !== null) {
        if (
          delta <= unit.confirmed * (payable + MEASURE.leaderMargin) &&
          delta % unit.confirmed !== 0
        ) {
          console.warn(
            `vote inclusion: unit ${unit.confirmed} of ${vote} demoted (delta ${delta}, payable ${payable})`
          );
          unit.confirmed = null;
          unit.candidate = null;
        }
        continue;
      }
      if (payable < MEASURE.unitCandidateMinPayable || delta % payable !== 0) {
        continue;
      }
      const value = delta / payable;
      const candidate = unit.candidate;
      if (candidate && candidate.value === value) {
        candidate.payableGcd = gcd(candidate.payableGcd, payable);
        if (candidate.payableGcd === 1) {
          unit.confirmed = value;
        }
      } else {
        unit.candidate = { value, payableGcd: payable };
      }
    }
  }

  private _unitOf(vote: string): Unit {
    let unit = this._units.get(vote);
    if (!unit) {
      unit = { confirmed: null, candidate: null };
      this._units.set(vote, unit);
    }
    return unit;
  }

  private _publish(
    a: Point,
    b: Point,
    deltas: Map<string, number>,
    payable: number,
    measured: Measured
  ): void {
    const seq = ++this._seq;
    const windows = new Map<string, StoredWindow>();
    for (const [vote, vb] of b.byVote) {
      const delta = deltas.get(vote);
      const result = this._classify(
        vote,
        vb,
        a.byVote.get(vote),
        delta,
        payable
      );
      windows.set(vote, {
        seq,
        fromSlot: a.bankSlot,
        toSlot: b.bankSlot,
        takenAt: b.takenAt,
        ...result,
      });
      this._trackOffline(vote, delta, result.kind, payable);
    }

    // Shared misses (spec §4.6): a deficit P − k that other validators with
    // at least 5% of the measured stake also have, most likely a leader that
    // left those votes out. The validator's own stake is no sign of that:
    // counted in, a validator with 5% of the stake would never be held to
    // the misses it has alone.
    const stakeByDeficit = new Map<number, bigint>();
    const ownStake = new Map<string, bigint>();
    let missedStake = 0n;
    for (const vote of measured.votes) {
      const w = windows.get(vote);
      const v = b.byVote.get(vote);
      if (!w || !v || w.kind !== 'measured' || w.included >= w.payable) {
        continue;
      }
      const deficit = w.payable - w.included;
      stakeByDeficit.set(
        deficit,
        (stakeByDeficit.get(deficit) ?? 0n) + stakeOf(v)
      );
      ownStake.set(vote, stakeOf(v));
      missedStake += stakeOf(v);
    }
    for (const [vote, w] of windows) {
      if (w.kind === 'measured' && w.included < w.payable) {
        const othersStake =
          (stakeByDeficit.get(w.payable - w.included) ?? 0n) -
          (ownStake.get(vote) ?? 0n);
        w.shared =
          share(othersStake, measured.stake) >= MEASURE.sharedMissStakeShare;
      }
      this._append(vote, w);
    }

    const stakeShareMissed = share(missedStake, measured.stake);
    this._published.push({
      takenAt: b.takenAt,
      durationMs: b.takenAt - a.takenAt,
      cluster: {
        payable,
        stakeShareMissed,
        alert: stakeShareMissed >= MEASURE.clusterAlertStakeShare,
      },
    });
    this._prune(b.takenAt);
  }

  // Spec §4.6.
  private _classify(
    vote: string,
    vb: ValidatorSnapshot,
    va: ValidatorSnapshot | undefined,
    delta: number | undefined,
    payable: number
  ): WindowResult {
    if (
      !va ||
      delta === undefined ||
      delta < 0 ||
      vb.delinquent ||
      va.delinquent
    ) {
      return notMeasured(payable);
    }
    if (payable === 0) {
      return { kind: 'no_paying_blocks', included: 0, payable: 0, shared: false };
    }
    if (delta === 0) {
      return { kind: 'measured', included: 0, payable, shared: false };
    }
    const unit = this.confirmedUnit(vote);
    if (unit === null) {
      return notMeasured(payable);
    }
    if (delta % unit === 0 && delta / unit <= payable) {
      return { kind: 'measured', included: delta / unit, payable, shared: false };
    }
    if (delta > unit * (payable + MEASURE.leaderMargin)) {
      return { kind: 'leader', included: 0, payable, shared: false };
    }
    return notMeasured(payable);
  }

  // Offline run (spec §4.7): paying blocks in a row without the vote. Only a
  // published window extends it; any window with D > 0 (a leader window
  // too) resets it in _resetOfflineRuns.
  private _trackOffline(
    vote: string,
    delta: number | undefined,
    kind: WindowKind,
    payable: number
  ): void {
    if (kind === 'measured' && delta === 0) {
      this._offline.set(vote, this.offlineRun(vote) + payable);
    }
  }

  private _resetOfflineRuns(deltas: Map<string, number>): void {
    for (const [vote, delta] of deltas) {
      if (delta > 0) {
        this._offline.delete(vote);
      }
    }
  }

  private _publishUnmeasured(a: Point, b: Point): void {
    const seq = ++this._seq;
    for (const vote of b.byVote.keys()) {
      this._append(vote, {
        seq,
        fromSlot: a.bankSlot,
        toSlot: b.bankSlot,
        takenAt: b.takenAt,
        ...notMeasured(0),
      });
    }
    this._published.push({
      takenAt: b.takenAt,
      durationMs: b.takenAt - a.takenAt,
      cluster: null,
    });
    this._prune(b.takenAt);
  }

  private _append(vote: string, w: StoredWindow): void {
    const list = this._windows.get(vote);
    if (list) {
      list.push(w);
    } else {
      this._windows.set(vote, [w]);
    }
  }

  private _recentWindows(vote: string, now: number): StoredWindow[] {
    const since = now - MEASURE.recentWindowMs;
    return (this._windows.get(vote) ?? []).filter((w) => w.takenAt > since);
  }

  private _prune(now: number): void {
    const since = now - MEASURE.recentWindowMs;
    for (const [vote, list] of this._windows) {
      const kept = list.filter((w) => w.takenAt > since);
      if (kept.length) {
        this._windows.set(vote, kept);
      } else {
        this._windows.delete(vote);
      }
    }
    this._published = this._published.filter((p) => p.takenAt > since);
  }
}
