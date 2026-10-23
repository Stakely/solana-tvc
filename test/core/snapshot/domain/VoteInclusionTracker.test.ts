/**
 * @jest-environment node
 */
import { Snapshot } from '@/types/snapshot.ts';
import { Network } from '@/core/snapshot/domain/Network.ts';
import {
  VoteInclusionTracker,
  bankSlotOf,
} from '@/core/snapshot/domain/VoteInclusionTracker.ts';
import {
  SLOTS_PER_EPOCH,
  SimValidator,
  Simulation,
  simBudget,
  simValidators,
} from '../../../support/simulate.ts';

// vote → 1 for v01..vNN: those validators miss one block in the window.
const missing = (count: number, blocks = 1): Record<string, number> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      `v${String(i + 1).padStart(2, '0')}`,
      blocks,
    ])
  );

function setup(validators: SimValidator[] = simValidators(25), epoch = 500) {
  const sim = new Simulation(validators, epoch);
  const tracker = new VoteInclusionTracker(Network.mainnet());
  tracker.setBudget(simBudget(epoch));
  const ingest = (snapshot: Snapshot, publish = true) =>
    tracker.ingest(snapshot, sim.takenAt, publish);
  ingest(sim.snapshot());
  // Two windows with different P confirm every unit.
  const learn = () => {
    ingest(sim.step(20));
    ingest(sim.step(21));
  };
  return { sim, tracker, ingest, learn };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('bankSlotOf', () => {
  it('is the highest last vote of non-delinquent validators, plus one', () => {
    const sim = new Simulation(simValidators(3));
    const snapshot = sim.snapshot();
    snapshot.validators[0] = {
      ...snapshot.validators[0],
      delinquent: true,
      lastVote: 10 ** 12,
    };
    expect(bankSlotOf(snapshot)).toBe(sim.slot);
    expect(
      bankSlotOf({
        ...snapshot,
        validators: snapshot.validators.map((v) => ({ ...v, delinquent: true })),
      })
    ).toBeNull();
  });
});

describe('VoteInclusionTracker: when a window is measured', () => {
  it('skips the first snapshot and snapshots of the same slot', () => {
    const sim = new Simulation(simValidators(25));
    const tracker = new VoteInclusionTracker(Network.mainnet());
    tracker.setBudget(simBudget(500));
    expect(tracker.ingest(sim.snapshot(), sim.takenAt, true)).toEqual({
      kind: 'skipped',
      reason: 'first',
    });
    expect(tracker.ingest(sim.snapshot(), sim.takenAt + 5_000, true)).toEqual({
      kind: 'skipped',
      reason: 'same_slot',
    });
  });

  it('needs the reward budget of the snapshot epoch', () => {
    const sim = new Simulation(simValidators(25));
    const tracker = new VoteInclusionTracker(Network.mainnet());
    tracker.ingest(sim.snapshot(), sim.takenAt, true);
    expect(tracker.ingest(sim.step(20), sim.takenAt, true)).toEqual({
      kind: 'skipped',
      reason: 'budget',
    });
  });

  it('skips windows longer than 20 s', () => {
    const { sim, ingest } = setup();
    expect(ingest(sim.step(20, { ms: 21_000 }))).toEqual({
      kind: 'skipped',
      reason: 'gap',
    });
  });

  it('skips windows in the migration epoch', () => {
    const { sim, ingest } = setup(simValidators(25), 1064);
    expect(ingest(sim.step(20))).toEqual({
      kind: 'skipped',
      reason: 'migration',
    });
  });

  it('skips windows that start in the first 8 slots of an epoch', () => {
    const sim = new Simulation(simValidators(25));
    sim.slot = 500 * SLOTS_PER_EPOCH + 2;
    const tracker = new VoteInclusionTracker(Network.mainnet());
    tracker.setBudget(simBudget(500));
    tracker.ingest(sim.snapshot(), sim.takenAt, true);
    expect(tracker.ingest(sim.step(20), sim.takenAt, true)).toEqual({
      kind: 'skipped',
      reason: 'epoch_start',
    });
  });

  it('skips windows where more than 1% of validators went backwards', () => {
    const { sim, ingest } = setup();
    sim.credits.set('v01', 0);
    expect(ingest(sim.step(20))).toEqual({
      kind: 'skipped',
      reason: 'backends',
    });
  });

  it('starts again when bankSlot enters a new epoch', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
    sim.slot = 501 * SLOTS_PER_EPOCH + 1_000;
    expect(ingest(sim.step(20))).toEqual({
      kind: 'skipped',
      reason: 'epoch_change',
    });
    expect(tracker.epoch).toBe(501);
    expect(tracker.confirmedUnit('v01')).toBeNull();
    expect(ingest(sim.step(20))).toEqual({ kind: 'skipped', reason: 'budget' });
  });

  it('starts again when the CLI switches to the next epoch counters', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    for (const v of sim.validators) {
      sim.credits.set(v.vote, 1_000);
    }
    expect(ingest(sim.step(20))).toEqual({
      kind: 'skipped',
      reason: 'epoch_change',
    });
    expect(tracker.confirmedUnit('v01')).toBeNull();
  });

  it('ignores a snapshot from a backend that lags behind and keeps the epoch state', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    const lagging = sim.step(20);
    ingest(lagging);
    ingest(sim.step(20, { missed: { v01: 20 } }));
    sim.takenAt += 5_000;
    expect(ingest(lagging)).toEqual({ kind: 'skipped', reason: 'backends' });
    expect(tracker.epoch).toBe(500);
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
    expect(tracker.offlineRun('v01')).toBe(20);
    expect(tracker.recent('v01', sim.takenAt)).toHaveLength(4);
    // The next window starts from the newest snapshot, not the lagging one.
    expect(ingest(sim.step(20))).toEqual({
      kind: 'window',
      payable: 20,
      published: true,
    });
  });

  it('stays in the new epoch when a lagging backend still reads the previous one', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    const lagging = sim.step(20);
    ingest(lagging);
    sim.slot = 501 * SLOTS_PER_EPOCH + 1_000;
    expect(ingest(sim.step(20))).toMatchObject({ reason: 'epoch_change' });
    tracker.setBudget(simBudget(501));
    learn();
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
    // The measure service reads the budget of each snapshot's epoch.
    expect(tracker.needsBudget(500)).toBe(false);
    tracker.setBudget(simBudget(500));
    expect(tracker.budget()?.epoch).toBe(501);
    sim.takenAt += 5_000;
    expect(ingest(lagging)).toEqual({ kind: 'skipped', reason: 'backends' });
    expect(tracker.epoch).toBe(501);
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
  });
});

describe('VoteInclusionTracker: paying blocks (P)', () => {
  it('finds P from D / û before any unit is confirmed', () => {
    const { sim, ingest } = setup();
    expect(ingest(sim.step(20))).toEqual({
      kind: 'window',
      payable: 20,
      published: true,
    });
  });

  // A validator that went delinquent is still in the epoch's stake set, which
  // sets every unit (spec §2). Leaving its stake out of S′ would raise every û
  // by 1 / (1 − d): P = 19 for 20 blocks with 4% delinquent, and no P at all
  // for 12 blocks (a mainnet window) with 2.5% delinquent.
  it.each<{ count: number; blocks: number }>([
    { count: 25, blocks: 20 },
    { count: 40, blocks: 12 },
  ])(
    'finds P from D / û while one of $count equal validators is delinquent',
    ({ count, blocks }) => {
      const { sim, ingest } = setup(simValidators(count));
      sim.delinquent.add('v03');
      expect(ingest(sim.step(blocks))).toEqual({
        kind: 'window',
        payable: blocks,
        published: true,
      });
    }
  );

  it('keeps the record when a thin block left most of the stake out', () => {
    const { sim, ingest, learn } = setup();
    learn();
    expect(ingest(sim.step(20, { missed: missing(20) }))).toMatchObject({
      payable: 20,
    });
  });

  it('does not measure a window whose P exceeds its slots', () => {
    const { sim, ingest } = setup();
    expect(ingest(sim.step(20, { slots: 10 }))).toEqual({
      kind: 'window',
      payable: null,
      published: true,
    });
  });

  it('accepts windows without paying blocks', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    expect(ingest(sim.step(0, { slots: 3 }))).toMatchObject({ payable: 0 });
    expect(tracker.recent('v01', sim.takenAt).at(-1)?.kind).toBe(
      'no_paying_blocks'
    );
  });
});

describe('VoteInclusionTracker: units', () => {
  it('confirms a unit with two windows of different P', () => {
    const { tracker, learn } = setup();
    learn();
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
    expect(tracker.confirmedShare()).toBe(1);
  });

  it('does not confirm with two windows of the same P', () => {
    const { sim, tracker, ingest } = setup();
    ingest(sim.step(20));
    ingest(sim.step(20));
    expect(tracker.confirmedUnit('v01')).toBeNull();
  });

  it('confirms units far from the estimate and measures them right', () => {
    const validators = simValidators(25);
    validators[23] = { ...validators[23], unit: 28_000 };
    validators[24] = { ...validators[24], unit: 75_200 };
    const { sim, tracker, ingest, learn } = setup(validators);
    learn();
    for (let i = 0; i < 5; i++) {
      ingest(sim.step(20));
    }
    expect(tracker.confirmedUnit('v24')).toBe(28_000);
    expect(tracker.confirmedUnit('v25')).toBe(75_200);
    expect(tracker.status('v24', sim.takenAt)).toBe('ok');
    expect(tracker.status('v25', sim.takenAt)).toBe('ok');
    expect(tracker.recent('v25', sim.takenAt).at(-1)?.kind).toBe('measured');
  });

  it('never confirms a wrong unit for a validator that always misses one block', () => {
    const { sim, tracker, ingest } = setup();
    for (const blocks of [20, 25, 40, 21]) {
      ingest(sim.step(blocks, { missed: { v01: 1 } }));
    }
    expect(tracker.confirmedUnit('v02')).toBe(40_000);
    expect(tracker.confirmedUnit('v01')).toBeNull();
    expect(tracker.status('v01', sim.takenAt)).toBe('measuring');
    expect(tracker.recent('v01', sim.takenAt).at(-1)?.kind).toBe(
      'not_measured'
    );
  });

  // Missing m of P blocks gives the candidate u × (1 − m/P); two windows that
  // miss the same share give it twice with different P.
  it.each<{ unit: number; windows: [number, number][] }>([
    { unit: 40_000, windows: [[20, 1], [40, 2]] },
    { unit: 25_597, windows: [[11, 1], [22, 2]] },
  ])(
    'does not confirm a wrong unit for $unit from windows that miss the same share of blocks',
    ({ unit, windows }) => {
      const validators = simValidators(25);
      validators[0] = { ...validators[0], unit };
      const { sim, tracker, ingest, learn } = setup(validators);
      for (const [blocks, missed] of windows) {
        ingest(sim.step(blocks, { missed: { v01: missed } }));
      }
      expect(tracker.confirmedUnit('v01')).toBeNull();
      learn();
      expect(tracker.confirmedUnit('v01')).toBe(unit);
      ingest(sim.step(20));
      expect(tracker.recent('v01', sim.takenAt).at(-1)).toMatchObject({
        kind: 'measured',
        included: 20,
        payable: 20,
      });
    }
  );

  it('demotes a unit that stops dividing the deltas', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20, { leader: { v01: 7 } }));
    expect(tracker.confirmedUnit('v01')).toBeNull();
  });

  it('keeps units across a gap within the epoch', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20, { ms: 60_000 }));
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
  });

  it('learns without publishing when nobody is measuring', () => {
    const { sim, tracker, ingest } = setup();
    ingest(sim.step(20), false);
    ingest(sim.step(21), false);
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
    expect(tracker.recent('v01', sim.takenAt)).toEqual([]);
    expect(tracker.coverageSeconds(sim.takenAt)).toBe(0);
  });
});

describe('VoteInclusionTracker: windows and status', () => {
  it('counts exact inclusion and reports OK', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    for (let i = 0; i < 5; i++) {
      ingest(sim.step(20));
    }
    expect(tracker.status('v01', sim.takenAt)).toBe('ok');
    expect(tracker.last5m('v01', sim.takenAt)).toEqual({
      included: 121,
      payable: 121,
      missed: 0,
      sharedMissed: 0,
    });
  });

  it('shows Measuring until 100 paying blocks', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20));
    expect(tracker.status('v01', sim.takenAt)).toBe('measuring');
  });

  it('reports missing votes below 98%', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    for (let i = 0; i < 5; i++) {
      ingest(sim.step(20, { missed: { v01: 1 } }));
    }
    expect(tracker.last5m('v01', sim.takenAt)).toMatchObject({
      missed: 5,
      sharedMissed: 0,
    });
    expect(tracker.status('v01', sim.takenAt)).toBe('missing');
  });

  it.each<{ count: number; missed: string[] }>([
    { count: 25, missed: ['v01', 'v02', 'v03'] },
    { count: 10, missed: ['v01', 'v02'] },
  ])(
    'marks a deficit that other validators with 5% of the stake share as shared and does not hold it against the validator ($count validators)',
    ({ count, missed }) => {
      const { sim, tracker, ingest, learn } = setup(simValidators(count));
      learn();
      const blocks = Object.fromEntries(missed.map((vote) => [vote, 1]));
      for (let i = 0; i < 5; i++) {
        ingest(sim.step(20, { missed: blocks }));
      }
      for (const vote of missed) {
        expect(tracker.recent(vote, sim.takenAt).at(-1)?.shared).toBe(true);
        expect(tracker.last5m(vote, sim.takenAt)).toEqual({
          included: 116,
          payable: 121,
          missed: 5,
          sharedMissed: 5,
        });
        expect(tracker.status(vote, sim.takenAt)).toBe('ok');
      }
    }
  );

  // A validator's own miss is no sign of a thin block from the leader: with
  // its own stake counted, a validator with 5% of the stake (10% here) would
  // never be held to its misses, and two with 4% each would cover each other.
  it.each<{ count: number; missed: string[] }>([
    { count: 10, missed: ['v01'] },
    { count: 25, missed: ['v01', 'v02'] },
  ])(
    'does not count the stake of the validator itself toward a shared deficit ($count validators, $missed missing)',
    ({ count, missed }) => {
      const { sim, tracker, ingest, learn } = setup(simValidators(count));
      learn();
      const blocks = Object.fromEntries(missed.map((vote) => [vote, 1]));
      for (let i = 0; i < 5; i++) {
        expect(ingest(sim.step(20, { missed: blocks }))).toMatchObject({
          payable: 20,
        });
      }
      for (const vote of missed) {
        expect(tracker.recent(vote, sim.takenAt).at(-1)).toMatchObject({
          kind: 'measured',
          included: 19,
          payable: 20,
          shared: false,
        });
        expect(tracker.last5m(vote, sim.takenAt)).toEqual({
          included: 116,
          payable: 121,
          missed: 5,
          sharedMissed: 0,
        });
        expect(tracker.status(vote, sim.takenAt)).toBe('missing');
      }
    }
  );

  it('marks the miss of a small validator shared when a large one has the same deficit', () => {
    // v01 holds 10% of the stake and v02..v31 3% each.
    const validators = [
      { vote: 'v01', identity: 'n01', stake: 10n * 10n ** 14n },
      ...simValidators(31)
        .slice(1)
        .map((v) => ({ ...v, stake: 3n * 10n ** 14n })),
    ];
    const { sim, tracker, ingest, learn } = setup(validators);
    learn();
    expect(tracker.confirmedUnit('v01')).not.toBeNull();
    expect(tracker.confirmedUnit('v02')).not.toBeNull();
    ingest(sim.step(20, { missed: { v01: 1, v02: 1 } }));
    // v02 sees v01's 10% with the same deficit; v01 sees only v02's 3%.
    expect(tracker.recent('v02', sim.takenAt).at(-1)?.shared).toBe(true);
    expect(tracker.recent('v01', sim.takenAt).at(-1)?.shared).toBe(false);
  });

  it('leaves out windows where the validator produced a block', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20, { leader: { v01: 1_000_003 } }));
    expect(tracker.recent('v01', sim.takenAt).at(-1)?.kind).toBe('leader');
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
    expect(tracker.last5m('v01', sim.takenAt)?.payable).toBe(21);
  });

  it('reports not voting after 32 paying blocks without the vote', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20, { missed: { v01: 20 } }));
    ingest(sim.step(20, { missed: { v01: 20 } }));
    expect(tracker.offlineRun('v01')).toBe(40);
    expect(tracker.status('v01', sim.takenAt)).toBe('not_voting');
    ingest(sim.step(20));
    expect(tracker.offlineRun('v01')).toBe(0);
  });

  it('never reports not voting without a confirmed unit', () => {
    const { sim, tracker, ingest } = setup();
    // v01 never has a vote counted, so it cannot learn its unit. A validator
    // outside the epoch's paid set looks the same while it votes.
    for (const blocks of [20, 21, 20]) {
      ingest(sim.step(blocks, { missed: { v01: blocks } }));
    }
    expect(tracker.confirmedUnit('v02')).toBe(40_000);
    expect(tracker.confirmedUnit('v01')).toBeNull();
    expect(tracker.offlineRun('v01')).toBe(61);
    expect(tracker.status('v01', sim.takenAt)).toBe('measuring');
  });

  it('never reports missing votes, a leader window or k = 0 for D > 0 without a confirmed unit', () => {
    const { sim, tracker, ingest } = setup();
    for (let i = 0; i < 6; i++) {
      const leader = i % 2 === 1 ? { v01: 1_000_003 } : undefined;
      ingest(sim.step(20 + (i % 2), { missed: { v01: 1 }, leader }));
    }
    expect(tracker.confirmedUnit('v02')).toBe(40_000);
    expect(tracker.confirmedUnit('v01')).toBeNull();
    expect(tracker.recent('v01', sim.takenAt).map((w) => w.kind)).toEqual(
      Array(6).fill('not_measured')
    );
    expect(tracker.last5m('v01', sim.takenAt)).toBeNull();
    expect(tracker.status('v01', sim.takenAt)).toBe('measuring');
  });

  it('resets the offline run with any window where the validator earned, published or not', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20, { missed: { v01: 20 } }));
    ingest(sim.step(20, { missed: { v01: 20 } }), false);
    expect(tracker.offlineRun('v01')).toBe(20);
    ingest(sim.step(20), false);
    expect(tracker.offlineRun('v01')).toBe(0);
    ingest(sim.step(20, { missed: { v01: 20 } }));
    expect(tracker.offlineRun('v01')).toBe(20);
    expect(tracker.status('v01', sim.takenAt)).not.toBe('not_voting');
  });

  it('resets the offline run when the validator voted during a gap', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20, { missed: { v01: 20, v02: 20 } }));
    expect(
      ingest(sim.step(200, { ms: 60_000, missed: { v02: 200 } }))
    ).toEqual({ kind: 'skipped', reason: 'gap' });
    expect(tracker.offlineRun('v01')).toBe(0);
    expect(tracker.offlineRun('v02')).toBe(20);
  });

  it('knows the smallest measurable stake', () => {
    const { tracker } = setup();
    // û = 100 needs s ≥ 2 · 100 · N · S′ / Budget = 200 · 432,000 · 2.5e16 / 8.64e11.
    expect(tracker.minMeasurableStake()).toBe(2_500_000_000_000n);
    expect(
      new VoteInclusionTracker(Network.mainnet()).minMeasurableStake()
    ).toBeNull();
  });

  it('reports delinquent and not measurable validators', () => {
    const validators = [
      ...simValidators(25),
      { vote: 'v26', identity: 'n26', stake: 10n ** 9n },
    ];
    const { sim, tracker, ingest } = setup(validators);
    sim.delinquent.add('v03');
    expect(ingest(sim.step(20))).toMatchObject({ payable: 20 });
    expect(tracker.status('v03', sim.takenAt)).toBe('delinquent');
    expect(tracker.status('v26', sim.takenAt)).toBe('not_measurable');
    expect(tracker.status('nope', sim.takenAt)).toBeNull();
  });

  it('does not turn a full window into a leader window while some stake is delinquent', () => {
    const { sim, tracker, ingest } = setup();
    // v12..v18 miss 1 block and v19..v25 miss 2 in both learning windows, so
    // only v01..v11 (44% of the stake) confirm their unit and P still comes
    // from D / û.
    const missed: Record<string, number> = Object.fromEntries(
      sim.validators
        .slice(11)
        .map((v, i): [string, number] => [v.vote, i < 7 ? 1 : 2])
    );
    ingest(sim.step(20, { missed }));
    ingest(sim.step(21, { missed }));
    expect(tracker.confirmedUnit('v01')).toBe(40_000);
    expect(tracker.confirmedUnit('v12')).toBeNull();
    sim.delinquent.add('v25');
    // With P = 19, D = 20u > (P + 0.5)u of v01 would read as a leader window.
    expect(ingest(sim.step(20))).toMatchObject({ payable: 20 });
    expect(tracker.recent('v01', sim.takenAt).at(-1)).toMatchObject({
      kind: 'measured',
      included: 20,
      payable: 20,
    });
    expect(tracker.cluster(sim.takenAt)?.payable).toBe(20);
  });

  it('raises the cluster alert when 20% of the stake missed blocks', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    ingest(sim.step(20, { missed: missing(5) }));
    const cluster = tracker.cluster(sim.takenAt);
    expect(cluster?.payable).toBe(20);
    expect(cluster?.stakeShareMissed).toBeCloseTo(0.2);
    expect(cluster?.alert).toBe(true);
  });

  it('keeps the last 5 minutes of windows', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    for (let i = 0; i < 70; i++) {
      ingest(sim.step(20));
    }
    expect(tracker.recent('v01', sim.takenAt)).toHaveLength(60);
    expect(tracker.coverageSeconds(sim.takenAt)).toBe(300);
  });
});

describe('VoteInclusionTracker: measurement under review', () => {
  it('when P fails its sanity check in more than half of the last 12 windows', () => {
    const { sim, tracker, ingest, learn } = setup();
    learn();
    for (let i = 0; i < 7; i++) {
      ingest(sim.step(20, { slots: 5 }));
    }
    expect(tracker.measurement(sim.takenAt)).toBe('under_review');
    for (let i = 0; i < 12; i++) {
      ingest(sim.step(20));
    }
    expect(tracker.measurement(sim.takenAt)).toBe('ok');
  });

  it('when units are still unknown 2 minutes after the first window', () => {
    const { sim, tracker, ingest, learn } = setup();
    for (let i = 0; i < 26; i++) {
      ingest(sim.step(1));
    }
    expect(tracker.measurement(sim.takenAt)).toBe('under_review');
    learn();
    expect(tracker.measurement(sim.takenAt)).toBe('ok');
  });
});
