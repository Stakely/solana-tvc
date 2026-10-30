import { act, renderHook } from '@testing-library/react';
import { useLiveCounter } from '@/app/hooks/live-counter.tsx';

describe('useLiveCounter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const advance = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });

  it('shows the first reading at once', () => {
    const { result, rerender } = renderHook(({ t }) => useLiveCounter(t), {
      initialProps: { t: 0 },
    });
    rerender({ t: 563_405_058_671 });
    expect(result.current).toBe(563_405_058_671);
  });

  it('keeps climbing at the rate of the readings between them', () => {
    const { result, rerender } = renderHook(({ t }) => useLiveCounter(t), {
      initialProps: { t: 1_000 },
    });
    rerender({ t: 1_000 });
    advance(5_000);
    rerender({ t: 6_000 }); // 1 per ms
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      advance(1_000);
      seen.push(result.current);
    }
    // No reading for 8 s: it still moves every second, about 1000 a second.
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i] - seen[i - 1]).toBeGreaterThan(900);
    }
  });

  it('never goes down when it ran ahead of a reading', () => {
    const { result, rerender } = renderHook(({ t }) => useLiveCounter(t), {
      initialProps: { t: 1_000 },
    });
    advance(5_000);
    rerender({ t: 6_000 });
    advance(5_000);
    const before = result.current;
    rerender({ t: 8_000 }); // slower than it guessed
    advance(500);
    expect(result.current).toBeGreaterThanOrEqual(before);
  });

  it('does not carry the value past its cap', () => {
    const { result, rerender } = renderHook(({ t }) => useLiveCounter(t, 432_000), {
      initialProps: { t: 431_000 },
    });
    advance(5_000);
    rerender({ t: 431_990 }); // about 0.2 slots per ms: 432000 within 1 s
    advance(10_000);
    expect(result.current).toBe(432_000);
  });

  it('starts over when the target goes back (a new epoch)', () => {
    const { result, rerender } = renderHook(({ t }) => useLiveCounter(t), {
      initialProps: { t: 431_000 },
    });
    advance(5_000);
    rerender({ t: 431_900 });
    advance(1_000);
    rerender({ t: 120 });
    expect(result.current).toBe(120);
  });
});
