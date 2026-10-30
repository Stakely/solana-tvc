import { useEffect, useRef, useState } from 'react';

type Reading = { v: number; t: number };

// How often the shown value moves, and how far past the last reading it may
// be carried when readings stop coming (a hidden tab, a slow server).
const STEP_MS = 100;
const MAX_AHEAD_MS = 15_000;

// A counter that keeps moving between readings: the rate of the last
// readings carries it forward, so it climbs steadily instead of jumping
// when a new one comes every 5 to 10 s. It never goes down while the target
// keeps growing: if it ran ahead, it waits for the readings to catch up. A
// target below the previous one (a new epoch for the slot index) starts
// over. The first reading is shown as is, not counted up from zero. `max`
// caps the carried value (the slots of the epoch: the slot index must not
// pass them while the next epoch's reading is on its way).
export function useLiveCounter(target: number, max = Infinity): number {
  const [value, setValue] = useState(target);
  const readings = useRef<Reading[]>([]);
  const shown = useRef(target);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) return;
    const now = Date.now();
    const last = readings.current.at(-1);
    if (last === undefined || target < last.v) {
      readings.current = [{ v: target, t: now }];
      shown.current = target;
      setValue(target);
      return;
    }
    if (target !== last.v) {
      readings.current = [...readings.current, { v: target, t: now }].slice(-4);
    }
  }, [target]);

  useEffect(() => {
    const id = setInterval(() => {
      const list = readings.current;
      const last = list.at(-1);
      if (last === undefined) return;
      const first = list[0];
      const rate =
        list.length > 1 && last.t > first.t
          ? (last.v - first.v) / (last.t - first.t)
          : 0;
      const ahead = Math.min(Date.now() - last.t, MAX_AHEAD_MS);
      const next = Math.floor(
        Math.max(shown.current, Math.min(max, last.v + rate * ahead))
      );
      if (next !== shown.current) {
        shown.current = next;
        setValue(next);
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [max]);

  return value;
}
