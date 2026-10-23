/**
 * @jest-environment node
 */
import {
  approximateUnit,
  decodeRewardBudgets,
  halfLeaderReward,
  rewardBudgetFor,
} from '@/core/measure/domain/RewardBudget.ts';

// Real account data, read on 2026-10-22: mainnet in its first Alpenglow
// epoch (25 bytes) and testnet afterwards (49 bytes).
const MAINNET_1064 = 'l/juSOg4AACAlwYAAAAAACgEAAAAAAAAAA==';
const TESTNET_1067 =
  'DQ/LO6JkAQCAlwYAAAAAACsEAAAAAAAAAeAkzma6ZAEAgJcGAAAAAAAqBAAAAAAAAA==';
const bytes = (base64: string) =>
  Uint8Array.from(Buffer.from(base64, 'base64'));

describe('RewardBudget', () => {
  it('decodes the 25-byte layout', () => {
    expect(decodeRewardBudgets(bytes(MAINNET_1064))).toEqual([
      { epoch: 1064, budget: 62_570_307_188_887n, slotsPerEpoch: 432_000n },
    ]);
  });

  it('decodes the 49-byte layout and picks the block of an epoch', () => {
    const data = bytes(TESTNET_1067);
    expect(decodeRewardBudgets(data).map((b) => b.epoch)).toEqual([
      1067, 1066,
    ]);
    expect(rewardBudgetFor(data, 1067)?.budget).toBe(392_122_927_353_613n);
    expect(rewardBudgetFor(data, 1066)?.budget).toBe(392_226_728_191_200n);
    expect(rewardBudgetFor(data, 1068)).toBeNull();
  });

  it('rejects other layouts', () => {
    expect(() => decodeRewardBudgets(new Uint8Array(24))).toThrow(
      'unexpected reward budget account'
    );
  });

  it('computes û with integer arithmetic', () => {
    const budget = { epoch: 1, budget: 864_000_000n, slotsPerEpoch: 432_000n };
    expect(approximateUnit(budget, 50n, 100n)).toBe(500);
    expect(approximateUnit(budget, 50n, 0n)).toBe(0);
  });

  it('computes T/2', () => {
    const [mainnet] = decodeRewardBudgets(bytes(MAINNET_1064));
    expect(halfLeaderReward(mainnet)).toBeCloseTo(72_419_337.024, 2);
  });
});
