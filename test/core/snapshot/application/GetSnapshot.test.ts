/**
 * @jest-environment node
 */

import path from 'path';
import {
  ClientsProvider,
  GetSnapshot,
  SnapshotExtrasProvider,
} from '@/core/snapshot/application/GetSnapshot.ts';
import { SnapshotQuery } from '@/core/snapshot/domain/SnapshotQuery.ts';
import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';
import {
  GetSnapshotArgs,
  GetSnapshotResponse,
  Snapshot,
  ValidatorSnapshot,
} from '@/types/snapshot.ts';
import { InclusionStatus, SnapshotMeta } from '@/types/measure.ts';
import { Factory } from '@/core/Factory.ts';
import { ValidatorInfoParser } from '@/core/snapshot/domain/ValidatorInfoParser.ts';
import { ValidatorSnapshotFreshener } from '@/core/snapshot/domain/ValidatorSnapshotFreshener.ts';
import { ValidatorInfoFreshener } from '@/core/snapshot/domain/ValidatorInfoFreshener.ts';

const PUFFIN = 'puffinQSvKFriPbyE5atyx1ptfnyytovbzxybr1jsyy';
const PUFFIN_VOTE = 'PUFFiNkUHF2DMfbKeUcYTSQckDDtkswfxZCDv5WQqwp';
const SEVEN = '7pR7t5axFfkg2VZB1uAuFNUvpAeowq2v15J4gw5MmHTB';
const SEVEN_VOTE = '59k9CiZ7L1bpEivLrAtaMPMgw18syZ4RQsJUo3hbbj8x';

// Fixture: puffin (stake 1000, commission 10) and 7pR7 (stake 2000,
// commission 0, delinquent). `parser` replaces the snapshot of the fixture.
function build(
  extras?: SnapshotExtrasProvider,
  parser?: SnapshotParser,
  clients?: ClientsProvider
) {
  const dir = path.join(process.cwd(), 'test/core/snapshot/application');
  const query = new SnapshotQuery(
    parser ?? new SnapshotParser(path.join(dir, 'snapshot.test.json')),
    new ValidatorInfoParser(path.join(dir, 'validator_info.test.json')),
    Factory.SnapshotReducer()
  );
  // Local fixtures: the fresheners, which call the Solana CLI and rewrite
  // public/, are inert doubles.
  const noopFreshener = () => ({
    ensureFresh: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  });
  const appService = new GetSnapshot(
    query,
    noopFreshener() as unknown as ValidatorSnapshotFreshener,
    noopFreshener() as unknown as ValidatorInfoFreshener,
    extras,
    clients
  );
  return (args: GetSnapshotArgs) =>
    appService.exec(args) as Promise<GetSnapshotResponse>;
}

const extras = (
  measuring: boolean,
  byVote: Record<string, { ratio?: number; status?: InclusionStatus; included?: number }>,
  override: Partial<SnapshotMeta> = {}
): SnapshotExtrasProvider => ({
  tableExtras: () => ({
    meta: {
      instance: 'test',
      epoch: 1065,
      migrationEpoch: false,
      measurement: 'ok',
      measuring,
      minMeasurableStake: '600000000000',
      ...override,
    },
    byVote: (vote) => {
      const v = byVote[vote] ?? {};
      return {
        epochRatio: v.ratio ?? null,
        epochRatioState: v.ratio === undefined ? 'pending' : 'ok',
        ...(measuring && v.status
          ? {
              inclusion: {
                status: v.status,
                included: v.included ?? 100,
                payable: 100,
                missed: 100 - (v.included ?? 100),
              },
            }
          : {}),
      };
    },
  }),
});

const ids = (response: GetSnapshotResponse) =>
  response.snapshot.validators.map((v) => v.identityPubkey);

const rankings = (response: GetSnapshotResponse) =>
  response.snapshot.validators.map((v) => v.ranking);

const validator = (
  name: string,
  stake: number,
  delinquent = false
): ValidatorSnapshot => ({
  activatedStake: String(stake),
  commission: 0,
  credits: 0,
  delinquent,
  epochCredits: 0,
  identityPubkey: name,
  lastVote: 10,
  rootSlot: 10,
  skipRate: 0,
  version: '4.0.0',
  voteAccountPubkey: `${name}-vote`,
});

// A snapshot parser that serves these validators, in this order.
const parserOf = (validators: ValidatorSnapshot[]): SnapshotParser => {
  const snapshot: Snapshot = {
    averageSkipRate: 0,
    averageStakeWeightedSkipRate: 0,
    stakeByVersion: {},
    totalActiveStake: '0',
    totalCurrentStake: '0',
    totalDelinquentStake: '0',
    validators,
  };
  return { parse: async () => snapshot } as unknown as SnapshotParser;
};

describe('Get Snapshot test', () => {
  it('orders by stake by default, delinquent validators last', async () => {
    const response = await build()({});
    expect(ids(response)).toEqual([PUFFIN, SEVEN]);
    expect(response.snapshot.validators[0].ranking).toBe(1);
    expect(response.snapshot.validators[1].ranking).toBeUndefined();
    expect(response.measuring).toBe(false);
  });

  it('ranks by stake when the measure service is wired in but nobody measures', async () => {
    // The normal production case: extras are provided, no measure request in
    // the last 20 s and the request names no order. Votes counted would leave
    // every validator without a rank, as nobody has an inclusion status.
    const response = await build(
      extras(false, {}),
      parserOf([
        validator('small', 1000),
        validator('big', 3000, true),
        validator('mid', 2000),
      ])
    )({});
    expect(ids(response)).toEqual(['mid', 'small', 'big']);
    expect(rankings(response)).toEqual([1, 2, undefined]);
    expect(response.measuring).toBe(false);
  });

  it('should return the snapshot with the correct pagination', async () => {
    const sut = build();
    let response = await sut({ page: 1, size: 1 });
    expect(ids(response)).toEqual([PUFFIN]);
    response = await sut({ page: 2, size: 1 });
    expect(ids(response)).toEqual([SEVEN]);
  });

  it('falls back to the default page and size on 0 or a non-numeric value', async () => {
    const sut = build();
    for (const value of [0, Number('abc')]) {
      expect(ids(await sut({ page: value, size: 1 }))).toEqual([PUFFIN]);
      expect((await sut({ size: value })).itemsPerPage).toBe(10);
    }
  });

  it('orders by stake by default, also while someone is measuring', async () => {
    // Votes counted arrives a few seconds after the page opens: ranking by
    // it by default would reorder the table under the user.
    const response = await build(
      extras(true, {
        [PUFFIN_VOTE]: { status: 'ok', included: 99 },
        [SEVEN_VOTE]: { status: 'ok', included: 100 },
      })
    )({});
    expect(ids(response)).toEqual([PUFFIN, SEVEN]);
  });

  it('orders by votes counted on request while someone is measuring', async () => {
    // By votes counted the status, not the CLI flag, decides the rank.
    const response = await build(
      extras(true, {
        [PUFFIN_VOTE]: { status: 'ok', included: 99 },
        [SEVEN_VOTE]: { status: 'ok', included: 100 },
      })
    )({ orderCriteria: 'inclusion' });
    expect(ids(response)).toEqual([SEVEN, PUFFIN]);
    expect(response.instance).toBe('test');
    expect(response.measuring).toBe(true);
    expect(response.snapshot.validators[0].inclusion?.status).toBe('ok');
  });

  it.each<[string, Partial<SnapshotMeta>]>([
    ['the migration epoch', { migrationEpoch: true }],
    ['a measurement under review', { measurement: 'under_review' }],
  ])('orders by stake during %s, although someone is measuring', async (_, meta) => {
    // The measure service then leaves votes counted out of the table.
    const response = await build(extras(true, {}, meta))({});
    expect(ids(response)).toEqual([PUFFIN, SEVEN]);
    expect(response.snapshot.validators[0].ranking).toBe(1);
  });

  it('measures while someone looks at the table', async () => {
    const provider = extras(false, {});
    const watch = jest.fn();
    await build({ ...provider, watch })({});
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('adds the client of each identity and refreshes the client table', async () => {
    const clients = {
      refresh: jest.fn(async () => undefined),
      clientOf: (identity: string) =>
        identity === PUFFIN ? 'JitoLabs' : undefined,
    };
    const response = await build(undefined, undefined, clients)({});
    const byIdentity = new Map(
      response.snapshot.validators.map((v) => [v.identityPubkey, v.client])
    );
    expect(byIdentity.get(PUFFIN)).toBe('JitoLabs');
    expect(byIdentity.get(SEVEN)).toBeUndefined();
    expect(clients.refresh).toHaveBeenCalledTimes(1);
    // Per version, only current validators count (7pR7 is delinquent).
    expect(response.snapshot.stakeByVersion['4.0.0'].clients).toEqual([
      { client: 'JitoLabs', validators: 1, activeStake: '1000' },
    ]);
    expect(response.snapshot.stakeByVersion['3.1.7'].clients).toEqual([]);
  });

  it('orders by epoch ratio on request, delinquent validators last', async () => {
    // 7pR7 went delinquent with the higher ratio (spec §5.1).
    const response = await build(
      extras(false, {
        [PUFFIN_VOTE]: { ratio: 0.998 },
        [SEVEN_VOTE]: { ratio: 0.999 },
      })
    )({ orderCriteria: 'epochRatio' });
    expect(ids(response)).toEqual([PUFFIN, SEVEN]);
    expect(rankings(response)).toEqual([1, undefined]);
    expect(response.snapshot.validators[1].epochRatio).toBe(0.999);

    // Puffin without a ratio takes no rank either (by stake it would be
    // first): both are listed by stake.
    const pending = await build(
      extras(false, { [SEVEN_VOTE]: { ratio: 0.999 } })
    )({ orderCriteria: 'epochRatio' });
    expect(ids(pending)).toEqual([SEVEN, PUFFIN]);
    expect(rankings(pending)).toEqual([undefined, undefined]);
  });

  it('should return the snapshot by commission order', async () => {
    const response = await build()({
      orderCriteria: 'commission',
      orderDirection: 'desc',
    });
    expect(ids(response)).toEqual([PUFFIN, SEVEN]);
    // The fixture only has commissionBps (newer CLIs): it becomes commission.
    expect(response.snapshot.validators[0].commission).toBe(10);
    expect(response.snapshot.validators[0]).not.toHaveProperty('commissionBps');
    // 7pR7 is delinquent: no rank under this order either.
    expect(rankings(response)).toEqual([1, undefined]);
  });

  it('should return the snapshot with identity filter', async () => {
    expect(ids(await build()({ publicKey: SEVEN }))).toEqual([SEVEN]);
  });

  it('filters by vote account', async () => {
    expect(ids(await build()({ publicKey: PUFFIN_VOTE }))).toEqual([PUFFIN]);
  });

  it('should return the snapshot with validator name filter', async () => {
    expect(ids(await build()({ publicKey: 'Puffin Validator' }))).toEqual([
      PUFFIN,
    ]);
  });

  it('rejects the old credits order and invalid criteria', async () => {
    const sut = build();
    await expect(
      sut({ orderCriteria: 'credits' as 'stake' })
    ).rejects.toThrow('Invalid order criteria');
    await expect(
      sut({ orderCriteria: 'invalid' as 'stake' })
    ).rejects.toThrow('Invalid order criteria');
  });

  it('should return error if is order direction is invalid', async () => {
    await expect(
      build()({ orderDirection: 'invalid' as 'asc' })
    ).rejects.toThrow('Invalid order direction');
  });

  it('should return error if is page is invalid', async () => {
    await expect(build()({ page: -10 })).rejects.toThrow('Invalid page');
  });

  it('should return error if is size is invalid', async () => {
    const sut = build();
    await expect(sut({ size: 51 })).rejects.toThrow('Invalid size');
    await expect(sut({ size: -1 })).rejects.toThrow('Invalid size');
  });
});
