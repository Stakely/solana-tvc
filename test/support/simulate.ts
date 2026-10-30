import { Snapshot, ValidatorSnapshot } from '@/types/snapshot.ts';
import { RewardBudget } from '@/core/measure/domain/RewardBudget.ts';

export const SLOTS_PER_EPOCH = 432_000;

// T = 2,000,000 lamports per slot. With 25 validators of 4% each, every one
// gets û = 40,000, and a produced block pays its leader about 1,000,000.
export function simBudget(epoch: number): RewardBudget {
  return { epoch, budget: 432_000n * 2_000_000n, slotsPerEpoch: 432_000n };
}

export function encodeBudget(budget: RewardBudget): Uint8Array {
  const data = new Uint8Array(25);
  const view = new DataView(data.buffer);
  view.setBigUint64(0, budget.budget, true);
  view.setBigUint64(8, budget.slotsPerEpoch, true);
  view.setBigUint64(16, BigInt(budget.epoch), true);
  return data;
}

export type SimValidator = {
  vote: string;
  identity: string;
  stake: bigint;
  unit?: number;
};

// v01..vNN with identities n01..nNN, 1,000,000 SOL each.
export function simValidators(count: number): SimValidator[] {
  return Array.from({ length: count }, (_, i) => {
    const id = String(i + 1).padStart(2, '0');
    return { vote: `v${id}`, identity: `n${id}`, stake: 10n ** 15n };
  });
}

export type StepOptions = {
  slots?: number;
  ms?: number;
  missed?: Record<string, number>;
  leader?: Record<string, number>;
};

// A cluster whose epochCredits grow as Alpenglow pays them (spec §2): unit ×
// blocks that included the vote, plus a leader share.
export class Simulation {
  slot: number;
  takenAt = 1_000_000;
  blocks = 1_000;
  readonly units = new Map<string, number>();
  readonly credits = new Map<string, number>();
  readonly delinquent = new Set<string>();

  constructor(
    readonly validators: SimValidator[],
    readonly epoch: number = 500
  ) {
    this.slot = epoch * SLOTS_PER_EPOCH + 1_000;
    const total = validators.reduce((sum, v) => sum + v.stake, 0n);
    const budget = simBudget(epoch);
    for (const v of validators) {
      const unit =
        v.unit ??
        Number((budget.budget * v.stake) / (budget.slotsPerEpoch * total) / 2n);
      this.units.set(v.vote, unit);
      this.credits.set(v.vote, this.blocks * unit);
    }
  }

  snapshot(): Snapshot {
    return {
      averageSkipRate: 0,
      averageStakeWeightedSkipRate: 0,
      stakeByVersion: {},
      totalActiveStake: '0',
      totalCurrentStake: '0',
      totalDelinquentStake: '0',
      validators: this.validators.map(
        (v): ValidatorSnapshot => ({
          activatedStake: v.stake.toString(),
          commission: 0,
          credits: 0,
          delinquent: this.delinquent.has(v.vote),
          epochCredits: this.credits.get(v.vote) ?? 0,
          identityPubkey: v.identity,
          lastVote: this.delinquent.has(v.vote)
            ? this.slot - 500
            : this.slot - 1,
          rootSlot: 0,
          skipRate: null,
          version: '4.3.2',
          voteAccountPubkey: v.vote,
        })
      ),
    };
  }

  // One window: `blocks` paying blocks over `slots` slots (default: blocks).
  step(blocks: number, options: StepOptions = {}): Snapshot {
    this.slot += options.slots ?? blocks;
    this.takenAt += options.ms ?? 5_000;
    this.blocks += blocks;
    for (const v of this.validators) {
      if (this.delinquent.has(v.vote)) {
        continue;
      }
      const included = blocks - (options.missed?.[v.vote] ?? 0);
      const earned =
        included * (this.units.get(v.vote) ?? 0) +
        (options.leader?.[v.vote] ?? 0);
      this.credits.set(v.vote, (this.credits.get(v.vote) ?? 0) + earned);
    }
    return this.snapshot();
  }
}
