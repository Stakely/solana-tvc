/**
 * @jest-environment node
 */
import {
  EpochRatioInput,
  computeEpochRatios,
} from '@/core/measure/domain/EpochRatio.ts';
import { Snapshot, ValidatorSnapshot } from '@/types/snapshot.ts';

const U = 25_597;
const B = 100_000;
const HALF = 72_419_337;
const MOST = U * B + 10 * HALF;

const validator = (extra: Partial<ValidatorSnapshot>): ValidatorSnapshot => ({
  activatedStake: '155000000000000',
  commission: 5,
  credits: 0,
  delinquent: false,
  epochCredits: Math.round(0.999 * MOST),
  identityPubkey: 'n1',
  lastVote: 0,
  rootSlot: 0,
  skipRate: 0,
  version: '4.3.2',
  voteAccountPubkey: 'v1',
  ...extra,
});

const input = (
  v: ValidatorSnapshot,
  over: Partial<EpochRatioInput> = {}
): EpochRatioInput => ({
  snapshot: {
    averageSkipRate: 0,
    averageStakeWeightedSkipRate: 0,
    stakeByVersion: {},
    totalActiveStake: '0',
    totalCurrentStake: '0',
    totalDelinquentStake: '0',
    validators: [v],
  } as Snapshot,
  blocksProduced: B,
  leaderSlots: { n1: 10 },
  nearLeaders: new Set(),
  halfLeaderReward: HALF,
  unitOf: () => U,
  estimateOf: () => 25_000,
  previous: new Map(),
  ...over,
});

const ratioOf = (v: ValidatorSnapshot, over: Partial<EpochRatioInput> = {}) =>
  computeEpochRatios(input(v, over)).get(v.voteAccountPubkey);

describe('computeEpochRatios', () => {
  it('divides what the validator earned by the most its stake could earn', () => {
    const ratio = ratioOf(validator({}));
    expect(ratio?.state).toBe('ok');
    expect(ratio?.value).toBeCloseTo(0.999, 6);
  });

  it('a skipped own slot lowers it by T/2 over the maximum', () => {
    const ratio = ratioOf(validator({ epochCredits: U * B + 9 * HALF }));
    expect(ratio?.value).toBeCloseTo(1 - HALF / MOST, 9);
  });

  it('is pending without a unit, and unavailable when it cannot be learned', () => {
    expect(ratioOf(validator({}), { unitOf: () => null })?.state).toBe(
      'pending'
    );
    expect(
      ratioOf(validator({ delinquent: true }), { unitOf: () => null })?.state
    ).toBe('unavailable');
    expect(
      ratioOf(validator({}), { unitOf: () => null, estimateOf: () => 99 })
        ?.state
    ).toBe('unavailable');
  });

  // Not measurable (û < 100, spec §4.8): the tracker can confirm its unit as
  // it does any other's, but its stake is too small for a reliable one, so
  // the cell shows "—" and it takes no rank by epoch ratio (§5.1).
  it('is unavailable for a not-measurable validator even with a confirmed unit', () => {
    expect(
      ratioOf(validator({}), { unitOf: () => U, estimateOf: () => 99 })
    ).toEqual({ value: null, state: 'unavailable' });
    expect(
      ratioOf(validator({}), { unitOf: () => U, estimateOf: () => 100 })?.state
    ).toBe('ok');
  });

  // It keeps the ratio of the unit it confirmed before it went delinquent;
  // OrderReducer lists it without a rank.
  it('keeps the ratio of a delinquent validator with a confirmed unit', () => {
    expect(ratioOf(validator({ delinquent: true }))?.state).toBe('ok');
  });

  // Accounts outside the epoch's stake set are always delinquent (spec §7), so
  // the delinquent flag alone marks them "—", with or without credits.
  it('is unavailable for a delinquent validator with no credits and no unit', () => {
    expect(
      ratioOf(validator({ delinquent: true, epochCredits: 0 }), {
        unitOf: () => null,
      })
    ).toEqual({ value: null, state: 'unavailable' });
  });

  // One that is not delinquent but has no credits yet (for instance, just
  // back from delinquent) can still learn its unit this epoch: "…", not "—".
  it('keeps a non-delinquent validator with no credits pending without a unit', () => {
    expect(
      ratioOf(validator({ epochCredits: 0 }), { unitOf: () => null })
    ).toEqual({ value: null, state: 'pending' });
  });

  it('is pending below 1,000 blocks', () => {
    expect(ratioOf(validator({}), { blocksProduced: 999 })).toEqual({
      value: null,
      state: 'pending',
    });
  });

  it('keeps the previous value while the validator leads a slot near bankSlot', () => {
    const previous = new Map([['v1', { value: 0.9991, state: 'ok' as const }]]);
    expect(
      ratioOf(validator({}), { nearLeaders: new Set(['n1']), previous })
    ).toEqual({ value: 0.9991, state: 'ok' });
  });

  it('is unavailable above 1.0005', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(
      ratioOf(validator({ epochCredits: Math.round(1.001 * MOST) }))
    ).toEqual({ value: null, state: 'unavailable' });
    jest.restoreAllMocks();
  });
});
