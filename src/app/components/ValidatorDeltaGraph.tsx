'use client';

import React from 'react';
import { Delta } from '@/app/components/ValidatorMonitor.tsx';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Text, Tooltip } from '@/app/components/ui';

type ValidatorDeltaGraphProps = {
  deltas: Delta[];
  maxBars?: number;
  height?: number | string;
  barWidth?: number;
  gap?: number;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function useContainerWidth<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setWidth(w);
    });

    ro.observe(el);

    setWidth(el.getBoundingClientRect().width);

    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

export function ValidatorDeltaGraph({
  deltas,
  maxBars = 60,
  height = 160,
  barWidth = 15,
  gap = 8,
}: ValidatorDeltaGraphProps) {
  const { colors } = useTheme();
  const { ref, width } = useContainerWidth<HTMLDivElement>();

  const getCreditLabelColor = (hPct: number) => {
    if (hPct === 100) return colors.secondary.blueMedium;
    if (hPct > 90) return colors.secondary.greenMedium;
    if (hPct > 70) return colors.secondary.yellowMedium;
    if (hPct > 50) return '#FF7748';
    return colors.secondary.redMedium;
  };

  const getBarColor = (hPct: number) => {
    if (hPct === 100)
      return 'linear-gradient(0deg,rgba(34, 193, 195, 1) 0%, rgba(79, 180, 247, 1) 100%)';
    if (hPct > 90)
      return 'linear-gradient(0deg,rgba(34, 193, 195, 1) 0%, rgba(77, 190, 110, 1) 100%)';
    if (hPct > 70)
      return 'linear-gradient(0deg,rgba(255, 234, 207, 1) 0%, rgba(247, 193, 116, 1) 100%)';
    if (hPct > 50)
      return 'linear-gradient(0deg,rgba(255, 108, 59, 1) 0%, rgba(247, 186, 166, 1) 100%)';
    return 'linear-gradient(0deg,rgba(255, 0, 0, 1) 0%, rgba(247, 93, 92, 1) 100%)';
  };

  const barsThatFit = React.useMemo(() => {
    if (!width) return maxBars;
    const perBar = barWidth + gap;
    if (perBar <= 0) return maxBars;
    const fit = Math.floor((width + gap) / perBar);

    return Math.max(1, fit);
  }, [width, barWidth, gap, maxBars]);

  const visibleBars = Math.min(maxBars, barsThatFit);
  const shown = deltas
    .slice(1)
    .slice(Math.max(0, deltas.length - 1 - visibleBars));

  return (
    <div
      ref={ref}
      className={'w-full flex items-end p-x-30 p-y-20'}
      role="img"
      style={{
        gap,
        height,
        borderRadius: 0,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      {shown.length < 1 && (
        <Text content={'Initializing session, taking samples...'} />
      )}
      {shown.length >= 1 &&
        shown.map((d, idx) => {
          const total = d.earnedCredits + d.lostCredits;
          const earnedRatio = total > 0 ? d.earnedCredits / total : 0;
          const hPct = clamp01(earnedRatio) * 100;

          return (
            <div
              key={`${d.from}-${d.to}-${idx}`}
              style={{
                width: barWidth,
                height: '100%',
                borderRadius: 0,
                background: 'rgba(255,255,255,0.10)',
                position: 'relative',
                overflow: 'hidden',
                flex: '0 0 auto',
              }}
            >
              <Tooltip
                backgroundColor={colors.background['07']}
                content={
                  <div className={'w-full flex-col gap-20'}>
                    <div className={'w-full flex gap-20'}>
                      <div className={'w-full flex-col gap-5'}>
                        <Text content={'From slot:'} />
                        <Text content={d.from.toString()} />
                      </div>
                      <div className={'w-full flex-col gap-5'}>
                        <Text content={'To slot:'} />
                        <Text content={d.to.toString()} />
                      </div>
                    </div>
                    <div className={'w-full flex gap-20'}>
                      <div className={'w-full flex-col gap-5'}>
                        <Text content={'Earned:'} />
                        <Text
                          content={d.earnedCredits.toString()}
                          color={getCreditLabelColor(hPct)}
                        />
                      </div>
                      <div className={'w-full flex-col gap-5'}>
                        <Text content={'Missed:'} />
                        <Text
                          content={d.lostCredits.toString()}
                          color={getCreditLabelColor(hPct)}
                        />
                      </div>
                    </div>
                  </div>
                }
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${hPct}%`,
                    borderRadius: 0,
                    background: getBarColor(hPct),
                    transition: 'height 220ms ease',
                  }}
                />
              </Tooltip>
            </div>
          );
        })}
    </div>
  );
}
