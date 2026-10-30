import { act, renderHook } from '@testing-library/react';
import { useAnimatedBigInt } from '@/app/hooks/animated-big-int.tsx';
import { useAnimatedNumber } from '@/app/hooks/animated-number.tsx';

describe('animated counters', () => {
  it('show the first reading at once instead of counting up from zero', () => {
    const big = renderHook(({ t }) => useAnimatedBigInt(t, 5_000), {
      initialProps: { t: '0' },
    });
    big.rerender({ t: '563405058671' });
    expect(big.result.current).toBe('563405058671');

    const small = renderHook(({ t }) => useAnimatedNumber(t, 5_000), {
      initialProps: { t: 0 },
    });
    small.rerender({ t: 413_939 });
    expect(small.result.current).toBe(413_939);
  });

  it('roll from one reading to the next over the whole duration', () => {
    jest.useFakeTimers();
    try {
      const big = renderHook(({ t }) => useAnimatedBigInt(t, 5_000), {
        initialProps: { t: '1000' },
      });
      big.rerender({ t: '2000' });
      act(() => {
        jest.advanceTimersByTime(2_500);
      });
      const halfway = Number(big.result.current);
      expect(halfway).toBeGreaterThan(1000);
      expect(halfway).toBeLessThan(2000);
      act(() => {
        jest.advanceTimersByTime(3_000);
      });
      expect(big.result.current).toBe('2000');
    } finally {
      jest.useRealTimers();
    }
  });
});
