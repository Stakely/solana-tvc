/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Snapshot } from '@/types/snapshot.ts';
import { Network } from '@/core/snapshot/domain/Network.ts';
import { rewardBudgetFor } from '@/core/measure/domain/RewardBudget.ts';
import {
  IngestResult,
  VoteInclusionTracker,
} from '@/core/snapshot/domain/VoteInclusionTracker.ts';

type Fixture = {
  epoch: number;
  budget: string;
  votes: string[];
  identities: string[];
  stakes: string[];
  samples: {
    t: number;
    credits: number[];
    lastVote: number[];
    delinquent: number[];
  }[];
  refUnits: Record<string, number>;
};

// 24 snapshots of mainnet epoch 1064 (2026-10-21, about 7 s apart) with each
// validator's Alpenglow lamports. refUnits: each validator's unit over the
// whole 60-minute recording, the most frequent gcd of two of its deltas. It
// divides most of them: a window the validator led adds its leader part,
// which is not a multiple of the unit.
const fixture = JSON.parse(
  gunzipSync(
    readFileSync(
      path.join(process.cwd(), 'test/fixtures/mainnet-1064-replay.json.gz')
    )
  ).toString('utf-8')
) as Fixture;

function snapshotAt(i: number): Snapshot {
  const sample = fixture.samples[i];
  return {
    averageSkipRate: 0,
    averageStakeWeightedSkipRate: 0,
    stakeByVersion: {},
    totalActiveStake: '0',
    totalCurrentStake: '0',
    totalDelinquentStake: '0',
    validators: fixture.votes.map((vote, j) => ({
      activatedStake: fixture.stakes[j],
      commission: 0,
      credits: 0,
      delinquent: sample.delinquent[j] === 1,
      epochCredits: sample.credits[j],
      identityPubkey: fixture.identities[j],
      lastVote: sample.lastVote[j],
      rootSlot: 0,
      skipRate: null,
      version: '',
      voteAccountPubkey: vote,
    })),
  };
}

describe('VoteInclusionTracker on a mainnet recording', () => {
  // Epoch 1064 is the migration epoch; the replay reads its Alpenglow
  // segment as the CLI does from 1065 on.
  const tracker = new VoteInclusionTracker(
    Network.mainnet().withoutMigration()
  );
  const budget = rewardBudgetFor(
    Buffer.from(fixture.budget, 'base64'),
    fixture.epoch
  );
  if (budget) {
    tracker.setBudget(budget);
  }
  const results: IngestResult[] = fixture.samples.map((sample, i) =>
    tracker.ingest(snapshotAt(i), sample.t, true)
  );
  const end = fixture.samples[fixture.samples.length - 1].t;

  it('decodes the budget of the recorded epoch', () => {
    expect(budget?.epoch).toBe(fixture.epoch);
  });

  it('confirms units for at least 98% of the measurable stake', () => {
    expect(tracker.confirmedShare()).toBeGreaterThanOrEqual(0.98);
  });

  it('has a reference unit for every measurable validator', () => {
    // Measurable as in confirmedShare: not delinquent, û ≥ 100. The largest
    // validators lead the most windows; without a reference the next test
    // would not check their units.
    const unchecked = fixture.votes.filter((vote) => {
      const status = tracker.status(vote, end);
      return (
        status !== 'delinquent' &&
        status !== 'not_measurable' &&
        fixture.refUnits[vote] === undefined
      );
    });
    expect(unchecked).toEqual([]);
  });

  it('never confirms a unit that differs from the reference', () => {
    const wrong = fixture.votes.filter((vote) => {
      const unit = tracker.confirmedUnit(vote);
      const ref = fixture.refUnits[vote];
      return unit !== null && ref !== undefined && unit !== ref;
    });
    expect(wrong).toEqual([]);
  });

  it('finds P within its sanity range in every window', () => {
    const windows = results.filter((r) => r.kind === 'window');
    expect(windows.length).toBeGreaterThanOrEqual(18);
    expect(
      windows.filter((r) => r.kind === 'window' && r.payable === null)
    ).toEqual([]);
    expect(tracker.measurement(end)).toBe('ok');
  });
});
