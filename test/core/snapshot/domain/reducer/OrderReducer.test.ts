/**
 * @jest-environment node
 */
import { OrderReducer } from '@/core/snapshot/domain/reducer/OrderReducer.ts';
import { SnapshotQueryArgs } from '@/core/snapshot/domain/SnapshotQueryArgs.ts';
import {
  OrderCriteria,
  Snapshot,
  ValidatorSnapshot,
} from '@/types/snapshot.ts';
import { InclusionStatus } from '@/types/measure.ts';

const validator = (
  vote: string,
  extra: Partial<ValidatorSnapshot> = {}
): ValidatorSnapshot => ({
  activatedStake: '1000',
  commission: 0,
  credits: 0,
  delinquent: false,
  epochCredits: 0,
  identityPubkey: `id-${vote}`,
  lastVote: 0,
  rootSlot: 0,
  skipRate: null,
  version: '4.3.2',
  voteAccountPubkey: vote,
  ...extra,
});

const snapshot = (validators: ValidatorSnapshot[]): Snapshot => ({
  averageSkipRate: 0,
  averageStakeWeightedSkipRate: 0,
  stakeByVersion: {},
  totalActiveStake: '0',
  totalCurrentStake: '0',
  totalDelinquentStake: '0',
  validators,
});

const order = (
  criteria: OrderCriteria,
  validators: ValidatorSnapshot[],
  direction: 'asc' | 'desc' = 'desc'
) =>
  new OrderReducer()
    .apply(
      new SnapshotQueryArgs({ criteria, direction }, 50, 1),
      snapshot(validators)
    )
    .validators.map((v) => [v.voteAccountPubkey, v.ranking]);

const inclusion = (
  status: InclusionStatus,
  included: number,
  payable: number
) => ({ status, included, payable, missed: payable - included });

describe('OrderReducer', () => {
  it('orders by stake with exact big integers, delinquent last without a rank', () => {
    expect(
      order('stake', [
        validator('a', { activatedStake: '9007199254740992' }),
        validator('b', { activatedStake: '9007199254740993' }),
        validator('c', { activatedStake: '99999999999999999999', delinquent: true }),
      ])
    ).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', undefined],
    ]);
  });

  it('orders by votes counted, ties by fewer missed, unranked statuses last', () => {
    expect(
      order('inclusion', [
        validator('a', { inclusion: inclusion('ok', 99, 100) }),
        validator('b', { inclusion: inclusion('missing', 198, 200) }),
        validator('c', { inclusion: inclusion('ok', 100, 100), activatedStake: '1' }),
        validator('d', { inclusion: inclusion('measuring', 10, 10), activatedStake: '5000' }),
        validator('e', { activatedStake: '4000' }),
      ])
    ).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 3],
      ['d', undefined],
      ['e', undefined],
    ]);
  });

  it('orders by epoch ratio, validators without one last', () => {
    expect(
      order('epochRatio', [
        validator('a', { epochRatio: 0.9991 }),
        validator('b', { epochRatio: 0.9995 }),
        validator('c', { epochRatio: null }),
      ])
    ).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', undefined],
    ]);
  });

  // b is ahead of a under every order. The delinquent x and y hold the
  // highest and the lowest value of every order, x with the larger stake;
  // a delinquent keeps the epoch ratio of a unit it confirmed before, and
  // the tracker gives it the delinquent status (spec §4.8).
  const withDelinquent = [
    validator('a', {
      commission: 5,
      epochRatio: 0.9991,
      inclusion: inclusion('ok', 99, 100),
      version: '4.3.1',
    }),
    validator('y', {
      activatedStake: '3000',
      commission: 0,
      delinquent: true,
      epochRatio: 0.9,
      inclusion: inclusion('delinquent', 0, 0),
      version: '4.3.0',
    }),
    validator('b', {
      activatedStake: '2000',
      commission: 7,
      epochRatio: 0.9995,
      inclusion: inclusion('ok', 100, 100),
      version: '4.3.2',
    }),
    validator('x', {
      activatedStake: '5000',
      commission: 10,
      delinquent: true,
      epochRatio: 0.9999,
      inclusion: inclusion('delinquent', 0, 0),
      version: '4.3.3',
    }),
  ];

  it.each<OrderCriteria>([
    'stake',
    'inclusion',
    'epochRatio',
    'commission',
    'version',
  ])('lists delinquent validators last without a rank by %s', (criteria) => {
    expect(order(criteria, withDelinquent)).toEqual([
      ['b', 1],
      ['a', 2],
      ['x', undefined],
      ['y', undefined],
    ]);
    expect(order(criteria, withDelinquent, 'asc')).toEqual([
      ['a', 1],
      ['b', 2],
      ['x', undefined],
      ['y', undefined],
    ]);
  });
});

describe('OrderReducer by the other table columns', () => {
  it('orders by fewest missed votes, unranked statuses last', () => {
    expect(
      order(
        'missed',
        [
          validator('a', { inclusion: inclusion('ok', 97, 100) }),
          validator('b', { inclusion: inclusion('ok', 100, 100) }),
          validator('c', { inclusion: inclusion('measuring', 1, 1) }),
        ],
        'asc'
      )
    ).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', undefined],
    ]);
  });

  it('orders by last vote, skip rate and name', () => {
    const vs = [
      validator('a', { lastVote: 10, skipRate: 3, info: { identityPubkey: 'id-a', info: { name: 'zeta' } } as ValidatorSnapshot['info'] }),
      validator('b', { lastVote: 30, skipRate: 1, info: { identityPubkey: 'id-b', info: { name: 'Alpha' } } as ValidatorSnapshot['info'] }),
      validator('c', { lastVote: 20, skipRate: 2 }),
    ];
    expect(order('lastVote', vs).map(([v]) => v)).toEqual(['b', 'c', 'a']);
    expect(order('skipRate', vs, 'asc').map(([v]) => v)).toEqual(['b', 'c', 'a']);
    // Without a name the identity counts ("id-c").
    expect(order('name', vs, 'asc').map(([v]) => v)).toEqual(['b', 'c', 'a']);
  });

  it('orders versions by number, not by text', () => {
    const vs = [
      validator('a', { version: '4.3.2' }),
      validator('b', { version: '26.10.4' }),
      validator('c', { version: '4.10.0' }),
    ];
    expect(order('version', vs).map(([v]) => v)).toEqual(['b', 'c', 'a']);
  });
});
