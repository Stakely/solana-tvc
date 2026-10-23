import { MEASURE } from '@/core/measure/domain/Constants.ts';

// One reading of /api/epoch: when it arrived and its absolute slot.
export type SlotSample = { t: number; slot: number };

const KEEP_MS = 10 * MEASURE.slotTimeSampleMs;

// The readings kept to tell the polling rhythm: the newest one and the three
// gaps before it.
const RHYTHM_READINGS = 4;

// The longest polling cycle assumed: the wait plus 10 s of requests. With
// only pauses in sight, a pause is not taken for a slow poll.
const MAX_CYCLE_MS = 3 * MEASURE.measurePollMs;

// Adds a reading of /api/epoch, a sample or not, to the recent ones.
export function addReading(
  readings: SlotSample[],
  reading: SlotSample
): SlotSample[] {
  return [...readings, reading].slice(-RHYTHM_READINGS);
}

// How long a poll takes on this client. The data provider asks again
// measurePollMs after each answer, so readings arrive every measurePollMs
// plus the time the requests take; a pause only makes a gap longer, so the
// shortest recent gap is the cycle. Without a gap yet, measurePollMs.
function pollCycleMs(readings: SlotSample[]): number {
  const gaps = readings.slice(1).map((r, i) => r.t - readings[i].t);
  if (gaps.length === 0) return MEASURE.measurePollMs;
  return Math.min(
    MAX_CYCLE_MS,
    Math.max(MEASURE.measurePollMs, Math.min(...gaps))
  );
}

// Whether `reading` is a sample of the slot time, given the readings before
// it. /api/epoch serves its file while it refreshes it, and refreshes it only
// when a request arrives, so after a pause in polling (page load, hidden tab,
// network error) the first reading may carry a slot from long ago; as the
// base of a pair it would skew the slot time for up to ten spans. A reading
// whose slot moved since the previous one, at most one measurePollMs later
// than the polling cycle, was written in between: it is about as late as
// every other sample, and the lateness cancels out in the difference.
export function isSlotSample(
  readings: SlotSample[],
  reading: SlotSample
): boolean {
  const previous = readings.at(-1);
  return (
    previous !== undefined &&
    reading.slot > previous.slot &&
    reading.t - previous.t <= pollCycleMs(readings) + MEASURE.measurePollMs
  );
}

// Adds a sample. A slot that does not move forward (the same file again, or
// another RPC backend) is ignored; samples older than ten spans are dropped.
export function addSlotSample(
  samples: SlotSample[],
  sample: SlotSample
): SlotSample[] {
  const last = samples.at(-1);
  if (last && sample.slot <= last.slot) return samples;
  return [...samples, sample].filter((s) => s.t >= sample.t - KEEP_MS);
}

// Seconds per slot, measured from the oldest sample at least
// MEASURE.slotTimeSampleMs before the newest one (spec §6.2). Without such a
// pair it returns `previous`: the last measured value, or the fallback.
export function slotSeconds(
  samples: SlotSample[],
  previous: number = MEASURE.fallbackSlotSeconds
): number {
  const newest = samples.at(-1);
  if (!newest) return previous;
  const base = samples.find(
    (s) => newest.t - s.t >= MEASURE.slotTimeSampleMs
  );
  if (!base || newest.slot <= base.slot) return previous;
  return (newest.t - base.t) / 1_000 / (newest.slot - base.slot);
}
