import { CSSProperties } from 'react';
import { AppThemeColors } from '@/app/components/theme/theming.ts';
import { InclusionWindow } from '@/types/measure.ts';
import { LegendTone } from '@/app/components/measure-texts.ts';

// Colours of the monitor (spec §6.2), shared by the bars, the legend, the
// tooltips, the status chips and the tests.
export const LEADER_COLOR = '#9945FF';
export const NOT_MEASURED_COLOR = 'rgba(255,255,255,0.35)';
export const OUTLINE = `1px solid ${NOT_MEASURED_COLOR}`;
// Shared misses are hatched. The stripes keep at least 3:1 contrast against
// what they cover (WCAG 1.4.11): dark on the amber and red fills, light on
// the dark track, so that a 3 px red bar still shows them.
export const HATCH =
  'repeating-linear-gradient(45deg, rgba(0,0,0,0.6) 0 3px, transparent 3px 6px)';
export const TRACK_HATCH =
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 3px, transparent 3px 6px)';
// The empty part of a bar (the track above the fill).
export const TRACK_COLOR = 'rgba(255,255,255,0.10)';
// The status chips paint their own opaque background, so their labels
// (13 px bold, not large text) keep WCAG AA contrast, 4.5:1, whatever lies
// behind them: the table surface, the mobile cards or the page gradient behind
// the monitor header. On it, "Not measurable" is an opaque grey:
// NOT_MEASURED_COLOR, the grey of the bars, would only reach about 3:1.
export const STATUS_CHIP_BACKGROUND = '#000000';
export const NOT_MEASURABLE_TEXT_COLOR = '#999999';

export type BarTone = Exclude<LegendTone, 'shared'>;

export function toneOf(
  window: Pick<InclusionWindow, 'kind' | 'included' | 'payable'>
): BarTone {
  switch (window.kind) {
    case 'leader':
      return 'leader';
    case 'not_measured':
      return 'not_measured';
    case 'no_paying_blocks':
      return 'no_paying_blocks';
    case 'measured':
      if (window.payable <= 0) return 'no_paying_blocks';
      if (window.included >= window.payable) return 'full';
      return window.included <= 0 ? 'zero' : 'partial';
  }
}

export function toneStyle(
  colors: AppThemeColors,
  tone: LegendTone
): CSSProperties {
  switch (tone) {
    case 'full':
      return { backgroundColor: colors.secondary.greenMedium };
    case 'partial':
      return { backgroundColor: colors.secondary.yellowMedium };
    case 'zero':
      return { backgroundColor: colors.secondary.redMedium };
    case 'leader':
      return { backgroundColor: LEADER_COLOR };
    case 'not_measured':
      return { backgroundColor: NOT_MEASURED_COLOR };
    case 'no_paying_blocks':
      return { backgroundColor: 'transparent', border: OUTLINE };
    case 'shared':
      return {
        backgroundColor: colors.secondary.yellowMedium,
        backgroundImage: HATCH,
      };
  }
}

export type BarVisual = {
  tone: BarTone;
  shared: boolean;
  heightPct: number;
  // The fill, from the bottom up to heightPct.
  style: CSSProperties;
  // The whole bar behind the fill.
  trackStyle: CSSProperties;
};

// Height = included ÷ payable for measured windows; the other kinds fill the
// bar. A zero bar keeps a 3 px red sliver so it can be seen. Shared misses
// hatch the fill and the track too, so a shared red bar does not look like an
// own miss.
export function barVisual(
  colors: AppThemeColors,
  window: InclusionWindow
): BarVisual {
  const tone = toneOf(window);
  const measured = tone === 'full' || tone === 'partial' || tone === 'zero';
  const shared = window.shared && (tone === 'partial' || tone === 'zero');
  const heightPct = measured
    ? Math.min(100, Math.max(0, (window.included * 100) / window.payable))
    : 100;
  return {
    tone,
    shared,
    heightPct,
    style: {
      ...toneStyle(colors, tone),
      ...(shared ? { backgroundImage: HATCH } : {}),
      ...(tone === 'zero' ? { minHeight: 3 } : {}),
    },
    trackStyle:
      tone === 'no_paying_blocks'
        ? { backgroundColor: 'transparent' }
        : {
            backgroundColor: TRACK_COLOR,
            ...(shared ? { backgroundImage: TRACK_HATCH } : {}),
          },
  };
}
