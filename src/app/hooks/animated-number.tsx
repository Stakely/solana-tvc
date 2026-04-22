'use client';

import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(target: number, durationMs = 650) {
  const [value, setValue] = useState<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = value;
    const to = target;

    if (from === to) return;

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = from + (to - from) * t;
      setValue(Math.round(next));

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return value;
}
