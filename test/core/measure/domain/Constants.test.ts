/**
 * @jest-environment node
 */
import { MEASURE } from '@/core/measure/domain/Constants.ts';

describe('MEASURE', () => {
  it('holds only finite, positive numbers', () => {
    const invalid = Object.entries(MEASURE).filter(
      ([, value]) => !Number.isFinite(value) || value <= 0
    );
    expect(invalid).toEqual([]);
  });

  it('keeps every share within (0, 1] and every duration in whole ms', () => {
    for (const [name, value] of Object.entries(MEASURE)) {
      if (name.endsWith('Share')) {
        expect(value).toBeLessThanOrEqual(1);
      }
      if (name.endsWith('Ms')) {
        expect(Number.isInteger(value)).toBe(true);
      }
    }
    expect(MEASURE.epochRatioMax).toBeGreaterThan(1);
  });

  it('clamps the snapshot TTL around its 5 s default (spec §6.1)', () => {
    const { snapshotTtlMs, snapshotTtlMinMs, snapshotTtlMaxMs } = MEASURE;
    expect(snapshotTtlMs).toBe(5_000);
    expect(snapshotTtlMinMs).toBe(3_000);
    expect(snapshotTtlMaxMs).toBe(10_000);
    expect(snapshotTtlMinMs).toBeLessThanOrEqual(snapshotTtlMs);
    expect(snapshotTtlMs).toBeLessThanOrEqual(snapshotTtlMaxMs);
  });

  it('polls /api/measure every 5 s (spec §4.1.2, §6.2)', () => {
    expect(MEASURE.measurePollMs).toBe(5_000);
  });

  it('needs P >= 2 paying blocks before proposing a unit candidate (spec §4.5)', () => {
    // With P = 1 every positive delta is divisible by P, so it proves nothing.
    expect(MEASURE.unitCandidateMinPayable).toBe(2);
    expect(Number.isInteger(MEASURE.unitCandidateMinPayable)).toBe(true);
  });

  it('adds 0.5 to P before calling a window a leader window (spec §4.5)', () => {
    expect(MEASURE.leaderMargin).toBe(0.5);
  });

  it('guards leader slots in [bankSlot - 1, bankSlot + 2] (spec §5.2)', () => {
    expect(MEASURE.leaderGuardBefore).toBe(1);
    expect(MEASURE.leaderGuardAfter).toBe(2);
    // Number of slots that range covers, as slotLeaders(bankSlot - 1, count).
    expect(MEASURE.leaderGuardBefore + MEASURE.leaderGuardAfter + 1).toBe(4);
  });

  it('flags a review when more than half of 12 windows fail (spec §4.8)', () => {
    expect(MEASURE.reviewSanityWindows).toBe(12);
    expect(MEASURE.reviewSanityFailShare).toBe(0.5);
    const limit = Math.floor(
      MEASURE.reviewSanityWindows * MEASURE.reviewSanityFailShare
    );
    // "More than half" is strictly above 6 failures, so 7 or more.
    expect(limit).toBe(6);
  });

  it('samples the slot time 30 s apart with a 0.215 s fallback (spec §6.2)', () => {
    expect(MEASURE.slotTimeSampleMs).toBe(30_000);
    expect(MEASURE.fallbackSlotSeconds).toBe(0.215);
  });
});
