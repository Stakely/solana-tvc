import { Snapshot } from '@/types/snapshot.ts';
import { EpochRatio } from '@/types/measure.ts';
import { MEASURE } from '@/core/measure/domain/Constants.ts';

export type EpochRatioInput = {
  // C comes from this snapshot; block production was cut at its bankSlot.
  snapshot: Snapshot;
  blocksProduced: number;
  leaderSlots: Record<string, number>;
  nearLeaders: Set<string>;
  halfLeaderReward: number;
  unitOf: (vote: string) => number | null;
  estimateOf: (vote: string) => number | null;
  previous: Map<string, EpochRatio>;
};

const PENDING: EpochRatio = { value: null, state: 'pending' };
const UNAVAILABLE: EpochRatio = { value: null, state: 'unavailable' };

// epochRatio = C / (u × B + L × T/2) (spec §5.2).
export function computeEpochRatios(
  input: EpochRatioInput
): Map<string, EpochRatio> {
  const ratios = new Map<string, EpochRatio>();
  for (const v of input.snapshot.validators) {
    const vote = v.voteAccountPubkey;
    const unit = input.unitOf(vote);
    if (unit === null) {
      const estimate = input.estimateOf(vote);
      const unlearnable =
        v.delinquent ||
        (estimate !== null && estimate < MEASURE.minUnitEstimate);
      ratios.set(vote, unlearnable ? UNAVAILABLE : PENDING);
      continue;
    }
    if (input.blocksProduced < MEASURE.epochRatioMinBlocks) {
      ratios.set(vote, PENDING);
      continue;
    }
    // bankSlot can be one slot short: keep the last value meanwhile.
    if (input.nearLeaders.has(v.identityPubkey)) {
      ratios.set(vote, input.previous.get(vote) ?? PENDING);
      continue;
    }
    const most =
      unit * input.blocksProduced +
      (input.leaderSlots[v.identityPubkey] ?? 0) * input.halfLeaderReward;
    const value = v.epochCredits / most;
    if (value > MEASURE.epochRatioMax) {
      console.warn(`epoch ratio of ${vote} above the maximum: ${value}`);
      ratios.set(vote, UNAVAILABLE);
      continue;
    }
    ratios.set(vote, { value, state: 'ok' });
  }
  return ratios;
}
