'use client';

import { FC, useEffect, useRef, useState } from 'react';
import { InclusionWindow } from '@/types/measure.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Text, Tooltip } from '@/app/components/ui';
import { HelpTooltip } from '@/app/components/HelpTooltip.tsx';
import {
  GRAPH_BACKGROUND,
  GRAPH_BORDER,
  barVisual,
  toneStyle,
} from '@/app/components/inclusion-palette.ts';
import {
  HELP,
  LEGEND,
  MONITOR_TEXT,
  windowLabel,
  windowSlots,
  windowText,
} from '@/app/components/measure-texts.ts';
import { KEPT_WINDOWS } from '@/app/hooks/use-measure.tsx';

type InclusionGraphProps = {
  windows: InclusionWindow[];
  emptyText: string;
  maxBars?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
};

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect?.width ?? 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

const GraphLegend: FC = () => {
  const { colors } = useTheme();
  return (
    // 10px between items keeps the whole legend on one line on a desktop
    // card; narrower screens wrap it.
    <div className={'w-full flex flex-wrap items-center gap-10'}>
      <div className={'flex items-center gap-5'}>
        <Text variant={'littleBody'} content={MONITOR_TEXT.barsCaption} />
        <HelpTooltip text={HELP.monitorBar} size={'16px'} />
      </div>
      {LEGEND.map((item) => (
        <div key={item.tone} className={'flex items-center gap-5'}>
          <span
            aria-hidden={'true'}
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              ...toneStyle(colors, item.tone),
            }}
          />
          <Text variant={'littleBody'} content={item.label} />
          <HelpTooltip text={item.help} size={'16px'} />
        </div>
      ))}
    </div>
  );
};

// One bar per measured interval (spec §6.2), from the server's windows.
export const InclusionGraph: FC<InclusionGraphProps> = ({
  windows,
  emptyText,
  maxBars = KEPT_WINDOWS,
  height = 160,
  barWidth = 15,
  gap = 8,
}) => {
  const { colors } = useTheme();
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  // The container has 20 px of padding and a 1 px border above and below.
  const trackHeight = Math.max(0, height - 42);
  const fit = width
    ? Math.max(1, Math.floor((width + gap) / (barWidth + gap)))
    : maxBars;
  const shown = windows.slice(-Math.min(maxBars, fit));

  return (
    <div className={'w-full flex-col gap-10'}>
      <div
        ref={ref}
        role={'group'}
        aria-label={MONITOR_TEXT.barsGroup}
        className={'w-full flex items-end p-x-30 p-y-20'}
        style={{
          gap,
          height,
          background: GRAPH_BACKGROUND,
          border: GRAPH_BORDER,
          overflow: 'hidden',
        }}
      >
        {shown.length === 0 && <Text content={emptyText} />}
        {shown.map((window) => {
          const visual = barVisual(colors, window);
          return (
            <Tooltip
              key={window.seq}
              backgroundColor={colors.background['07']}
              content={
                <div className={'flex-col gap-5'}>
                  <Text content={windowText(window)} />
                  <Text variant={'body2'} content={windowSlots(window)} />
                </div>
              }
            >
              <div
                data-testid={'inclusion-bar'}
                role={'img'}
                aria-label={windowLabel(window)}
                data-tone={visual.tone}
                data-shared={visual.shared ? 'true' : 'false'}
                style={{
                  width: barWidth,
                  height: trackHeight,
                  position: 'relative',
                  overflow: 'hidden',
                  flex: '0 0 auto',
                  ...visual.trackStyle,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${visual.heightPct}%`,
                    transition: 'height 220ms ease',
                    ...visual.style,
                  }}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
      <GraphLegend />
    </div>
  );
};
