export const REWARD_BUDGET_ADDRESS =
  '3vJzniWALu2qGFJ1ZY6JD3Y2ZmA5zWqmVdDX7yBXHgu7';

export type RewardBudget = {
  epoch: number;
  budget: bigint;
  slotsPerEpoch: bigint;
};

// Vote-reward account layout (little-endian, spec §3): u64 budget,
// u64 slots_per_epoch, u64 epoch, u8 tag. With tag 1 (49 bytes), the
// previous epoch's 24 bytes follow.
export function decodeRewardBudgets(data: Uint8Array): RewardBudget[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const block = (offset: number): RewardBudget => ({
    budget: view.getBigUint64(offset, true),
    slotsPerEpoch: view.getBigUint64(offset + 8, true),
    epoch: Number(view.getBigUint64(offset + 16, true)),
  });

  if (data.byteLength === 25 && data[24] === 0) {
    return [block(0)];
  }
  if (data.byteLength === 49 && data[24] === 1) {
    return [block(0), block(25)];
  }
  throw new Error(
    `unexpected reward budget account: ${data.byteLength} bytes, tag ${data[24]}`
  );
}

export function rewardBudgetFor(
  data: Uint8Array,
  epoch: number
): RewardBudget | null {
  return decodeRewardBudgets(data).find((b) => b.epoch === epoch) ?? null;
}

// û = floor(floor(Budget × s / (N × S)) / 2) (spec §4.3).
export function approximateUnit(
  budget: RewardBudget,
  stake: bigint,
  totalStake: bigint
): number {
  if (totalStake <= 0n) {
    return 0;
  }
  return Number(
    (budget.budget * stake) / (budget.slotsPerEpoch * totalStake) / 2n
  );
}

// T/2 = Budget / N / 2: what a produced block pays its leader (spec §5.2).
export function halfLeaderReward(budget: RewardBudget): number {
  return Number(budget.budget) / Number(budget.slotsPerEpoch) / 2;
}
