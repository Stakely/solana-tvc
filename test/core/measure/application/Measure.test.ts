/**
 * @jest-environment node
 */
import {
  MeasureRpc,
  MeasureService,
} from '@/core/measure/application/Measure.ts';
import { SnapshotSource } from '@/core/snapshot/domain/SnapshotSource.ts';
import { VoteInclusionTracker } from '@/core/snapshot/domain/VoteInclusionTracker.ts';
import { Network } from '@/core/snapshot/domain/Network.ts';
import { BlockProduction } from '@/core/solana/SolanaRpc.ts';
import { REWARD_BUDGET_ADDRESS } from '@/core/measure/domain/RewardBudget.ts';
import { MeasureResponse } from '@/types/measure.ts';
import {
  SLOTS_PER_EPOCH,
  SimValidator,
  Simulation,
  StepOptions,
  encodeBudget,
  simBudget,
  simValidators,
} from '../../../support/simulate.ts';

type WorldOptions = {
  epoch?: number;
  validators?: SimValidator[];
  // 'advance': sleeping moves the clock; default: sleeping never ends, so a
  // learning burst stops after its first snapshot.
  sleep?: 'advance' | 'never';
  step?: (call: number) => [number, StepOptions?];
};

// A measure service over a simulated cluster: every CLI call steps the
// simulation by one window.
function world(options: WorldOptions = {}) {
  const clock = { t: 1_000_000 };
  const sim = new Simulation(
    options.validators ?? simValidators(25),
    options.epoch ?? 500
  );
  const step: (call: number) => [number, StepOptions?] =
    options.step ?? ((call) => [20 + (call % 3)]);
  let calls = 0;
  const cli = {
    validators: async () => {
      calls += 1;
      const [blocks, stepOptions] = step(calls);
      return JSON.stringify(sim.step(blocks, stepOptions));
    },
  };
  const source = new SnapshotSource(cli, null, () => clock.t);
  const rpc = {
    accountData: jest.fn(async () => encodeBudget(simBudget(sim.epoch))),
    blockProduction: jest.fn(
      async (firstSlot: number, lastSlot: number): Promise<BlockProduction> => ({
        firstSlot,
        lastSlot,
        byIdentity: { others: [sim.blocks, sim.blocks] },
      })
    ),
    slotLeaders: jest.fn(async (): Promise<string[]> => []),
  } satisfies MeasureRpc;
  const sleeps: number[] = [];
  const sleep =
    options.sleep === 'advance'
      ? async (ms: number) => {
          sleeps.push(ms);
          clock.t += ms;
        }
      : () => new Promise<void>(() => undefined);
  const tracker = new VoteInclusionTracker(Network.mainnet());
  const service = new MeasureService({
    source,
    rpc,
    tracker,
    network: Network.mainnet(),
    instance: 'test',
    now: () => clock.t,
    sleep,
  });
  return { clock, sim, rpc, tracker, service, sleeps, cliCalls: () => calls };
}

describe('MeasureService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shares one CLI call between concurrent measure requests', async () => {
    const { service, cliCalls } = world();
    await Promise.all([
      service.measure('v01'),
      service.measure('v02'),
      service.measure('v03'),
    ]);
    expect(cliCalls()).toBe(1);
  });

  it('reads the reward budget of the snapshot epoch', async () => {
    const { service, rpc, tracker } = world();
    await service.measure('v01');
    expect(rpc.accountData).toHaveBeenCalledWith(REWARD_BUDGET_ADDRESS);
    expect(tracker.budget()?.epoch).toBe(500);
    expect(service.tableExtras().meta.minMeasurableStake).toBe(
      tracker.minMeasurableStake()?.toString()
    );
  });

  // The reward budget is read in the background: a slow RPC must not hold
  // the ingest queue, so /api/measure answers while the read is pending and
  // the tracker skips windows ('budget') until it arrives.
  describe('while the reward budget read is pending', () => {
    const BLOCKED = 'blocked';
    const answered = <T>(promise: Promise<T>) =>
      Promise.race([
        promise,
        new Promise<typeof BLOCKED>((resolve) =>
          setTimeout(() => resolve(BLOCKED), 1_000)
        ),
      ]);

    type Rpc = ReturnType<typeof world>['rpc'];
    const neverAnswers = (rpc: Rpc) =>
      rpc.accountData.mockImplementation(
        () => new Promise<Uint8Array>(() => undefined)
      );
    // A read that answers when the test releases it.
    const heldBudget = (rpc: Rpc) => {
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      rpc.accountData.mockImplementation(async () => {
        await held;
        return encodeBudget(simBudget(500));
      });
      return () => release();
    };

    it('answers measure requests without waiting for it', async () => {
      const { service, rpc, tracker, clock } = world();
      neverAnswers(rpc);
      for (let i = 0; i < 3; i++) {
        const response = await answered(service.measure('v01'));
        expect(response).not.toBe(BLOCKED);
        if (response !== BLOCKED) {
          expect(response.validator?.recent).toEqual([]);
          expect(response.coverageSeconds).toBe(0);
        }
        clock.t += 5_000;
      }
      expect(tracker.budget()).toBeNull();
    });

    it('keeps a single read in flight', async () => {
      const { service, rpc, clock } = world();
      neverAnswers(rpc);
      for (let i = 0; i < 4; i++) {
        expect(await answered(service.measure('v01'))).not.toBe(BLOCKED);
        clock.t += 5_000;
      }
      expect(rpc.accountData).toHaveBeenCalledTimes(1);
    });

    it('measures from the next snapshot once the budget arrives', async () => {
      const { service, rpc, tracker, clock } = world();
      const release = heldBudget(rpc);
      expect(await answered(service.measure('v01'))).not.toBe(BLOCKED);
      clock.t += 5_000;
      const before = await answered(service.measure('v01'));
      expect(before !== BLOCKED && before.validator?.recent).toEqual([]);

      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(tracker.budget()?.epoch).toBe(500);

      clock.t += 5_000;
      const after = await answered(service.measure('v01'));
      expect(after !== BLOCKED && after.validator?.recent).toHaveLength(1);
      expect(rpc.accountData).toHaveBeenCalledTimes(1);
    });

    it('is awaited by idle()', async () => {
      const { service, rpc, tracker } = world({ sleep: 'advance' });
      const release = heldBudget(rpc);
      service.tableExtras();
      setTimeout(release, 10);
      await service.idle();
      expect(tracker.budget()?.epoch).toBe(500);
    });
  });

  it('measures the validator while requests keep coming', async () => {
    const { service, clock } = world();
    let response: MeasureResponse = await service.measure('v01');
    for (let i = 0; i < 9; i++) {
      clock.t += 5_000;
      response = await service.measure('v01');
    }
    expect(response.instance).toBe('test');
    expect(response.epoch).toBe(500);
    expect(response.measurement).toBe('ok');
    expect(response.coverageSeconds).toBe(45);
    expect(response.validator?.status).toBe('ok');
    expect(response.validator?.last5m?.missed).toBe(0);
    expect(response.validator?.recent).toHaveLength(9);
  });

  it('answers null for an unknown vote account', async () => {
    const { service } = world();
    expect((await service.measure('nope')).validator).toBeNull();
  });

  it('does not start measuring for an unknown vote account', async () => {
    const { service, clock } = world();
    await service.measure('nope');
    clock.t += 5_000;
    await service.measure('nope');
    expect(service.isMeasuring()).toBe(false);
    expect(service.tableExtras().meta.measuring).toBe(false);
  });

  it('stops publishing 20 s after the last measure request', async () => {
    const { service, clock } = world();
    await service.measure('v01');
    clock.t += 5_000;
    await service.measure('v01');
    expect(service.tableExtras().meta.measuring).toBe(true);
    expect(service.tableExtras().byVote('v01').inclusion).toBeDefined();
    clock.t += 21_000;
    const extras = service.tableExtras();
    expect(extras.meta.measuring).toBe(false);
    expect(extras.byVote('v01').inclusion).toBeUndefined();
  });

  it('measures nothing for Not measurable or Delinquent', async () => {
    const { service, sim, tracker, clock } = world({
      // v26 has 1,000 SOL: û = 39 < 100.
      validators: [
        ...simValidators(25),
        { vote: 'v26', identity: 'n26', stake: 10n ** 12n },
      ],
      // v25 and v26 are left out of every block: D = 0 is a measured k = 0.
      step: (call) => {
        const blocks = 20 + (call % 3);
        return [blocks, { missed: { v25: blocks, v26: blocks } }];
      },
    });
    await service.measure('v26');
    for (let i = 0; i < 4; i++) {
      clock.t += 5_000;
      await service.measure('v26');
    }
    sim.delinquent.add('v25');
    clock.t += 5_000;
    const responses = {
      v26: await service.measure('v26'),
      v25: await service.measure('v25'),
    };
    const statuses = { v26: 'not_measurable', v25: 'delinquent' } as const;
    for (const vote of ['v26', 'v25'] as const) {
      // The tracker counts their misses...
      expect(tracker.last5m(vote, clock.t)?.missed).toBeGreaterThan(0);
      expect(tracker.offlineRun(vote)).toBeGreaterThan(0);
      // ...but /api/measure shows no totals, no offline run and only grey
      // windows (the same windows, by seq).
      const validator = responses[vote].validator;
      expect(validator?.status).toBe(statuses[vote]);
      expect(validator?.last5m).toBeNull();
      expect(validator?.offlineRun).toBe(0);
      const recent = validator?.recent ?? [];
      expect(recent.map((w) => w.seq)).toEqual(
        tracker.recent(vote, clock.t).map((w) => w.seq)
      );
      expect(recent.length).toBeGreaterThan(0);
      for (const w of recent) {
        expect(w).toMatchObject({
          kind: 'not_measured',
          included: 0,
          shared: false,
        });
      }
    }
    // The table counts no measured window for them: 0 of 0 paying blocks
    // (spec §4.7 over measured windows), which the UI shows as "—".
    const extras = service.tableExtras();
    expect(extras.byVote('v26').inclusion).toStrictEqual({
      status: 'not_measurable',
      included: 0,
      payable: 0,
      missed: 0,
    });
    expect(extras.byVote('v25').inclusion).toStrictEqual({
      status: 'delinquent',
      included: 0,
      payable: 0,
      missed: 0,
    });
    // A measured validator keeps its counts.
    const v01 = tracker.last5m('v01', clock.t);
    expect(v01).not.toBeNull();
    expect(extras.byVote('v01').inclusion).toStrictEqual({
      status: tracker.status('v01', clock.t),
      included: v01?.included,
      payable: v01?.payable,
      missed: v01?.missed,
    });
  });

  it('counts 0 of 0 paying blocks in the table until a window is measured', async () => {
    const { service } = world();
    await service.measure('v01');
    expect(service.tableExtras().byVote('v01').inclusion).toStrictEqual({
      status: 'measuring',
      included: 0,
      payable: 0,
      missed: 0,
    });
  });

  it('runs a learning burst for the table without publishing windows', async () => {
    const { service, tracker, clock, cliCalls } = world({ sleep: 'advance' });
    service.tableExtras();
    await service.idle();
    expect(tracker.confirmedShare()).toBeGreaterThanOrEqual(0.99);
    expect(cliCalls()).toBeLessThanOrEqual(8);
    expect(tracker.recent('v01', clock.t)).toEqual([]);
    expect(service.tableExtras().meta.measuring).toBe(false);
  });

  it('cuts block production at the bankSlot of the snapshot it reads C from', async () => {
    const { service, rpc, sim } = world({ sleep: 'advance' });
    service.tableExtras();
    await service.idle();
    const [firstSlot, lastSlot] = rpc.blockProduction.mock.calls.at(-1) ?? [];
    expect(firstSlot).toBe(500 * SLOTS_PER_EPOCH);
    expect(lastSlot).toBe(sim.slot);
    const v01 = service.tableExtras().byVote('v01');
    expect(v01.epochRatioState).toBe('ok');
    expect(v01.epochRatio).toBeCloseTo(1, 9);
  });

  it('gives no epoch ratio to a Not measurable validator that learned its unit', async () => {
    const { service, tracker, clock } = world({
      sleep: 'advance',
      // v26 has 1,000 SOL: û = 39 < 100. It is in every block.
      validators: [
        ...simValidators(25),
        { vote: 'v26', identity: 'n26', stake: 10n ** 12n },
      ],
    });
    service.tableExtras();
    await service.idle();
    // The tracker confirms its unit as it does any other's...
    expect(tracker.status('v26', clock.t)).toBe('not_measurable');
    expect(tracker.confirmedUnit('v26')).not.toBeNull();
    // ...but the stake is too small for a reliable unit (spec §4.8): "—".
    const extras = service.tableExtras();
    expect(extras.byVote('v26')).toStrictEqual({
      epochRatio: null,
      epochRatioState: 'unavailable',
    });
    expect(extras.byVote('v01').epochRatioState).toBe('ok');
  });

  it('retries the burst at most every 10 minutes while units are missing', async () => {
    const { service, clock, sleeps } = world({
      sleep: 'advance',
      step: () => [20],
    });
    service.tableExtras();
    await service.idle();
    expect(sleeps).toHaveLength(7);
    clock.t += 60_000;
    service.tableExtras();
    await service.idle();
    expect(sleeps).toHaveLength(7);
    clock.t += 10 * 60_000;
    service.tableExtras();
    await service.idle();
    expect(sleeps).toHaveLength(14);
  });

  it('waits 10 minutes before retrying a burst whose CLI call failed', async () => {
    const { service, tracker, clock, cliCalls } = world({
      sleep: 'advance',
      step: (call) => {
        if (call === 1) {
          throw new Error('CLI failed');
        }
        return [20 + (call % 3)];
      },
    });
    service.tableExtras();
    await service.idle();
    expect(cliCalls()).toBe(1);
    clock.t += 10 * 60_000;
    service.tableExtras();
    await service.idle();
    expect(tracker.confirmedShare()).toBeGreaterThanOrEqual(0.99);
  });

  it('hides the numbers while the measurement is under review', async () => {
    const { service, clock } = world({
      step: (call) => [20 + (call % 3), call > 3 ? { slots: 5 } : {}],
    });
    let response: MeasureResponse = await service.measure('v01');
    for (let i = 0; i < 10; i++) {
      clock.t += 5_000;
      response = await service.measure('v01');
    }
    expect(response.measurement).toBe('under_review');
    expect(response.validator?.status).toBe('measuring');
    expect(response.validator?.last5m).toBeNull();
    expect(response.validator?.recent).toEqual([]);
    expect(response.validator?.epochRatio).toBeNull();
  });

  it('hides the offline run while the measurement is under review', async () => {
    const { service, tracker, clock } = world({
      // P = 20 in every window: the gcd of the P stays 20, no unit is
      // confirmed, and 2 minutes after the first window the measurement goes
      // under review. v25 is left out of every block: D = 0 extends its run.
      step: () => [20, { missed: { v25: 20 } }],
    });
    let response: MeasureResponse = await service.measure('v25');
    for (let i = 0; i < 26; i++) {
      clock.t += 5_000;
      response = await service.measure('v25');
    }
    expect(response.measurement).toBe('under_review');
    // The tracker counts the run...
    expect(tracker.offlineRun('v25')).toBeGreaterThan(0);
    // ...but under review the response hides it with the other misses.
    expect(response.validator?.status).toBe('measuring');
    expect(response.validator?.last5m).toBeNull();
    expect(response.validator?.recent).toEqual([]);
    expect(response.validator?.offlineRun).toBe(0);
  });

  it('measures nothing in the migration epoch', async () => {
    const { service, clock } = world({ epoch: 1064 });
    await service.measure('v01');
    clock.t += 5_000;
    const response = await service.measure('v01');
    expect(response.migrationEpoch).toBe(true);
    expect(response.validator?.recent).toEqual([]);
    expect(response.validator?.epochRatioState).toBe('unavailable');
  });

  // While the numbers are hidden, the statuses that rest on P read Measuring.
  // Not measurable (û, from the stake) and Delinquent (the CLI flag) do not
  // rest on it, so they stay.
  describe('while the numbers are hidden', () => {
    // v26 has 1,000 SOL: û = 39 < 100, whatever P is.
    const validators = [
      ...simValidators(25),
      { vote: 'v26', identity: 'n26', stake: 10n ** 12n },
    ];

    const statuses = async (service: MeasureService) => {
      const status = async (vote: string) =>
        (await service.measure(vote)).validator?.status;
      return {
        v01: await status('v01'),
        v25: await status('v25'),
        v26: await status('v26'),
      };
    };

    it('keeps Not measurable and Delinquent while the measurement is under review', async () => {
      const { service, sim, tracker, clock } = world({
        validators,
        // Windows that confirm the units and bring v01 to OK, then windows
        // with more paying blocks than slots: under review.
        step: (call) => [20 + (call % 3), call > 8 ? { slots: 5 } : {}],
      });
      await service.measure('v01');
      for (let i = 0; i < 17; i++) {
        clock.t += 5_000;
        await service.measure('v01');
      }
      sim.delinquent.add('v25');
      clock.t += 5_000;
      await service.measure('v25');

      // The tracker has a status for v01 that rests on P...
      expect(tracker.measurement(clock.t)).toBe('under_review');
      expect(tracker.status('v01', clock.t)).toBe('ok');
      // ...which the response hides.
      expect(await statuses(service)).toEqual({
        v01: 'measuring',
        v25: 'delinquent',
        v26: 'not_measurable',
      });
      const v26 = (await service.measure('v26')).validator;
      expect(v26?.last5m).toBeNull();
      expect(v26?.recent).toEqual([]);
    });

    it('keeps Not measurable and Delinquent in the migration epoch', async () => {
      const { service, sim, clock } = world({ epoch: 1064, validators });
      await service.measure('v01');
      sim.delinquent.add('v25');
      clock.t += 5_000;
      await service.measure('v25');

      expect((await service.measure('v01')).migrationEpoch).toBe(true);
      expect(await statuses(service)).toEqual({
        v01: 'measuring',
        v25: 'delinquent',
        v26: 'not_measurable',
      });
    });
  });
});
