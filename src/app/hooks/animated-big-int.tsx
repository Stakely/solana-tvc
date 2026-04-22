'use client';

import { useEffect, useRef, useState } from 'react';

function toBigIntSafe(input: string): bigint {
  const cleaned = (input ?? '').replace(/[,\s_]/g, '');
  if (!/^-?\d+$/.test(cleaned)) return 0n;
  return BigInt(cleaned);
}

export function useAnimatedBigInt(target: string, durationMs = 650) {
  const [value, setValue] = useState<string>(() =>
    toBigIntSafe(target).toString()
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = toBigIntSafe(value);
    const to = toBigIntSafe(target);

    if (from === to) return;

    const start = performance.now();
    const SCALE = 1_000_000n;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const ratio = BigInt(Math.round(t * Number(SCALE)));

      const delta = to - from;
      const next = from + (delta * ratio) / SCALE;

      setValue(next.toString());

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
