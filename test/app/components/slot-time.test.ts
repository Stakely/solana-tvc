import { MEASURE } from '@/core/measure/domain/Constants.ts';
import {
  addReading,
  addSlotSample,
  isSlotSample,
  slotSeconds,
} from '@/app/components/slot-time.ts';

describe('slot time', () => {
  const poll = MEASURE.measurePollMs;

  it('takes a reading as a sample only if its slot moved since a recent one', () => {
    const readings = [{ t: 0, slot: 1_000 }];
    // The first reading may be a file from long ago (page load).
    expect(isSlotSample([], { t: 0, slot: 1_000 })).toBe(false);
    // With one reading there is no rhythm yet: up to two polls apart.
    expect(isSlotSample(readings, { t: poll, slot: 1_012 })).toBe(true);
    expect(isSlotSample(readings, { t: 2 * poll, slot: 1_025 })).toBe(true);
    // After a pause in polling (hidden tab, network error) the file the
    // server refreshed on the last poll may be that old.
    expect(isSlotSample(readings, { t: 2 * poll + 1, slot: 1_025 })).toBe(
      false
    );
    // The same file again, or a backend that is behind.
    expect(isSlotSample(readings, { t: poll, slot: 1_000 })).toBe(false);
    expect(isSlotSample(readings, { t: poll, slot: 990 })).toBe(false);
  });

  it('allows one poll more than the polling rhythm of the client', () => {
    // Each poll takes 11 s: the 5 s wait plus 6 s of requests.
    const slow = [
      { t: 0, slot: 1_000 },
      { t: 11_000, slot: 1_027 },
      { t: 22_000, slot: 1_055 },
    ];
    expect(isSlotSample(slow, { t: 33_000, slot: 1_082 })).toBe(true);
    expect(isSlotSample(slow, { t: 22_000 + 11_000 + poll, slot: 1_095 })).toBe(
      true
    );
    expect(
      isSlotSample(slow, { t: 22_000 + 11_000 + poll + 1, slot: 1_095 })
    ).toBe(false);
  });

  it('takes the shortest recent gap as the rhythm, so a pause does not widen it', () => {
    const paused = [
      { t: 0, slot: 1_000 },
      { t: poll, slot: 1_012 },
      { t: 400_000, slot: 1_025 },
    ];
    expect(isSlotSample(paused, { t: 400_000 + 2 * poll, slot: 2_000 })).toBe(
      true
    );
    expect(
      isSlotSample(paused, { t: 400_000 + 2 * poll + 1, slot: 2_000 })
    ).toBe(false);
  });

  it('bounds the rhythm between one and three polls', () => {
    // Only a pause in sight (hidden right after the page loaded): the
    // rhythm is three polls at most, so a second pause is still a pause.
    const pause = [
      { t: 0, slot: 1_000 },
      { t: 400_000, slot: 1_012 },
    ];
    expect(isSlotSample(pause, { t: 400_000 + 4 * poll, slot: 2_000 })).toBe(
      true
    );
    expect(
      isSlotSample(pause, { t: 400_000 + 4 * poll + 1, slot: 2_000 })
    ).toBe(false);
    // A gap shorter than a poll (the table changed page) does not narrow it.
    const quick = [
      { t: 0, slot: 1_000 },
      { t: 1_000, slot: 1_000 },
    ];
    expect(isSlotSample(quick, { t: 1_000 + 2 * poll, slot: 1_025 })).toBe(
      true
    );
    expect(isSlotSample(quick, { t: 1_000 + 2 * poll + 1, slot: 1_025 })).toBe(
      false
    );
  });

  it('keeps the last four readings to tell the rhythm', () => {
    const readings = [0, 1, 2, 3].map((i) => ({ t: i * poll, slot: i }));
    const next = { t: 4 * poll, slot: 4 };
    expect(addReading(readings, next)).toEqual([...readings.slice(1), next]);
    expect(addReading([], next)).toEqual([next]);
  });

  it('uses the fallback until two samples are slotTimeSampleMs apart', () => {
    let samples = addSlotSample([], { t: 0, slot: 1_000 });
    expect(slotSeconds(samples)).toBe(MEASURE.fallbackSlotSeconds);
    samples = addSlotSample(samples, {
      t: MEASURE.slotTimeSampleMs - 1,
      slot: 1_070,
    });
    expect(slotSeconds(samples)).toBe(MEASURE.fallbackSlotSeconds);
    samples = addSlotSample(samples, { t: 40_000, slot: 1_100 });
    expect(slotSeconds(samples)).toBeCloseTo(0.4, 9);
  });

  it('ignores a slot that does not move forward (another RPC backend)', () => {
    const samples = [{ t: 0, slot: 1_000 }];
    expect(addSlotSample(samples, { t: 40_000, slot: 900 })).toBe(samples);
    expect(addSlotSample(samples, { t: 40_000, slot: 1_000 })).toBe(samples);
  });

  it('keeps ten sample spans of history', () => {
    const t = 10 * MEASURE.slotTimeSampleMs + 1;
    expect(addSlotSample([{ t: 0, slot: 1 }], { t, slot: 2 })).toEqual([
      { t, slot: 2 },
    ]);
  });

  it('keeps the last measured slot time when the old samples expire', () => {
    let samples = addSlotSample([], { t: 0, slot: 1_000 });
    samples = addSlotSample(samples, { t: 40_000, slot: 1_100 });
    const measured = slotSeconds(samples);
    expect(measured).toBeCloseTo(0.4, 9);
    // A tab hidden for more than five minutes: only the new sample is left.
    samples = addSlotSample(samples, { t: 400_000, slot: 2_000 });
    expect(samples).toHaveLength(1);
    expect(slotSeconds(samples, measured)).toBeCloseTo(0.4, 9);
  });
});
