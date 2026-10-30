/**
 * @jest-environment node
 */
import { SnapshotParser } from '@/core/snapshot/domain/SnapshotParser.ts';

// Shape of `solana validators --output json`; stake fields are bare
// integers above 2^53.
const validator = (commission: string) => `{
  "identityPubkey": "n1", "voteAccountPubkey": "v1", ${commission}
  "lastVote": 100, "rootSlot": 90, "credits": 5, "epochCredits": 1234,
  "activatedStake": 12345678901234567890, "version": "4.3.2",
  "delinquent": false, "skipRate": null }`;
const output = (v: string) => `{
  "totalActiveStake": 437521711000000000,
  "totalCurrentStake": 437521711000000000,
  "totalDelinquentStake": 0,
  "validators": [${v}],
  "averageSkipRate": 0.5,
  "averageStakeWeightedSkipRate": 0.4,
  "stakeByVersion": {} }`;

describe('SnapshotParser.parseText', () => {
  it('keeps stake fields as exact decimal strings', () => {
    const snapshot = SnapshotParser.parseText(
      output(validator('"commission": 5,'))
    );
    expect(snapshot.validators[0].activatedStake).toBe('12345678901234567890');
    expect(snapshot.totalActiveStake).toBe('437521711000000000');
    expect(snapshot.validators[0].epochCredits).toBe(1234);
  });

  it('fills commission from commissionBps on CLIs that only print it', () => {
    const snapshot = SnapshotParser.parseText(
      output(validator('"commissionBps": 500, "clientId": "Agave",'))
    );
    expect(snapshot.validators[0].commission).toBe(5);
    expect(snapshot.validators[0]).not.toHaveProperty('commissionBps');
  });

  it('keeps commission when the CLI prints it', () => {
    const snapshot = SnapshotParser.parseText(
      output(validator('"commission": 7, "commissionBps": 700,'))
    );
    expect(snapshot.validators[0].commission).toBe(7);
    expect(snapshot.validators[0]).not.toHaveProperty('commissionBps');
  });

  // Not a throw: a throw would drop the whole snapshot, freezing the table and
  // the measurement for every user, because SnapshotSource shares this parse.
  it('defaults a missing commission to 0 instead of throwing', () => {
    const snapshot = SnapshotParser.parseText(output(validator('')));
    expect(snapshot.validators[0].commission).toBe(0);
    expect(snapshot.validators[0]).not.toHaveProperty('commissionBps');
  });

  it('rejects other shapes', () => {
    expect(() => SnapshotParser.parseText('{"validators": 1}')).toThrow(
      'unexpected snapshot.json format'
    );
  });
});
