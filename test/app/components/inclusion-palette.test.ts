import { StakelyTheme } from '@/app/components/theme/design-system.ts';
import {
  GRAPH_BACKGROUND,
  GRAPH_BORDER,
  HATCH,
  LEADER_COLOR,
  NOT_MEASURED_COLOR,
  OUTLINE,
  TRACK_COLOR,
  TRACK_HATCH,
  barVisual,
  toneOf,
  toneStyle,
} from '@/app/components/inclusion-palette.ts';
import {
  Rgb,
  contrast,
  over,
  paint,
  stripePaint,
} from '../support/contrast.ts';
import { inclusionWindow } from '../support/fixtures.tsx';

const colors = StakelyTheme.colors;

// Contrast of the stripes of a hatch against the colour under them.
const stripeContrast = (base: Rgb, hatch: string | undefined): number =>
  contrast(over(base, stripePaint(hatch)), base);

// The bars sit on the frame of InclusionGraph, GRAPH_BACKGROUND, over a dark
// page colour.
const PAGES = [
  '#002120', // site theme, background '07'; the page gradient starts here
  '#003835', // site theme, background '05'
  '#004E54', // the lightest stop of the page gradient
  '#101541', // default theme, surface
  '#1B3382', // default theme, background '04'
  '#2F3568', // default theme, background '07'
];

describe('inclusion palette', () => {
  it('picks the tone of each window', () => {
    expect(toneOf(inclusionWindow(1))).toBe('full');
    expect(toneOf(inclusionWindow(1, { included: 7 }))).toBe('partial');
    expect(toneOf(inclusionWindow(1, { included: 0 }))).toBe('zero');
    expect(toneOf(inclusionWindow(1, { kind: 'leader' }))).toBe('leader');
    expect(toneOf(inclusionWindow(1, { kind: 'not_measured' }))).toBe(
      'not_measured'
    );
    expect(toneOf(inclusionWindow(1, { kind: 'no_paying_blocks' }))).toBe(
      'no_paying_blocks'
    );
    expect(toneOf(inclusionWindow(1, { included: 0, payable: 0 }))).toBe(
      'no_paying_blocks'
    );
  });

  it('uses the decided colours', () => {
    expect(toneStyle(colors, 'full')).toEqual({
      backgroundColor: colors.secondary.greenMedium,
    });
    expect(toneStyle(colors, 'partial')).toEqual({
      backgroundColor: colors.secondary.yellowMedium,
    });
    expect(toneStyle(colors, 'zero')).toEqual({
      backgroundColor: colors.secondary.redMedium,
    });
    expect(toneStyle(colors, 'leader')).toEqual({ backgroundColor: '#9945FF' });
    expect(LEADER_COLOR).toBe('#9945FF');
    expect(toneStyle(colors, 'not_measured')).toEqual({
      backgroundColor: 'rgba(255,255,255,0.35)',
    });
    expect(NOT_MEASURED_COLOR).toBe('rgba(255,255,255,0.35)');
    expect(toneStyle(colors, 'no_paying_blocks')).toEqual({
      backgroundColor: 'transparent',
      border: '1px solid rgba(255,255,255,0.35)',
    });
    expect(OUTLINE).toBe('1px solid rgba(255,255,255,0.35)');
    expect(HATCH).toBe(
      'repeating-linear-gradient(45deg, rgba(0,0,0,0.6) 0 3px, transparent 3px 6px)'
    );
  });

  it('sizes a measured bar by included ÷ payable and hatches shared misses', () => {
    expect(
      barVisual(colors, inclusionWindow(1, { included: 7, shared: true }))
    ).toEqual({
      tone: 'partial',
      shared: true,
      heightPct: 70,
      style: {
        backgroundColor: colors.secondary.yellowMedium,
        backgroundImage: HATCH,
      },
      trackStyle: {
        backgroundColor: TRACK_COLOR,
        backgroundImage: TRACK_HATCH,
      },
    });
  });

  it('keeps a zero bar visible and red', () => {
    expect(barVisual(colors, inclusionWindow(1, { included: 0 }))).toEqual({
      tone: 'zero',
      shared: false,
      heightPct: 0,
      style: { backgroundColor: colors.secondary.redMedium, minHeight: 3 },
      trackStyle: { backgroundColor: TRACK_COLOR },
    });
  });

  it('hatches the whole track of a shared red bar, unlike an own miss', () => {
    const own = barVisual(colors, inclusionWindow(1, { included: 0 }));
    const shared = barVisual(
      colors,
      inclusionWindow(1, { included: 0, shared: true })
    );
    expect(shared.shared).toBe(true);
    expect(shared.trackStyle).toEqual({
      backgroundColor: TRACK_COLOR,
      backgroundImage: TRACK_HATCH,
    });
    expect(own.trackStyle).toEqual({ backgroundColor: TRACK_COLOR });
    expect(shared.trackStyle).not.toEqual(own.trackStyle);
  });

  it('draws leader, not measured and empty windows at full height', () => {
    expect(
      barVisual(colors, inclusionWindow(1, { kind: 'leader' })).heightPct
    ).toBe(100);
    expect(
      barVisual(colors, inclusionWindow(1, { kind: 'no_paying_blocks' }))
    ).toEqual({
      tone: 'no_paying_blocks',
      shared: false,
      heightPct: 100,
      style: { backgroundColor: 'transparent', border: OUTLINE },
      // A transparent track keeps the outline readable.
      trackStyle: { backgroundColor: 'transparent' },
    });
  });

  it('never hatches a full bar', () => {
    expect(barVisual(colors, inclusionWindow(1, { shared: true })).shared).toBe(
      false
    );
  });

  // The server sends leader and not measured windows with included = 0.
  it('fills leader and not measured bars whatever their counts', () => {
    expect(
      barVisual(colors, inclusionWindow(1, { kind: 'leader', included: 0 }))
    ).toEqual({
      tone: 'leader',
      shared: false,
      heightPct: 100,
      style: { backgroundColor: LEADER_COLOR },
      trackStyle: { backgroundColor: TRACK_COLOR },
    });
    expect(
      barVisual(
        colors,
        inclusionWindow(1, { kind: 'not_measured', included: 0 })
      )
    ).toEqual({
      tone: 'not_measured',
      shared: false,
      heightPct: 100,
      style: { backgroundColor: NOT_MEASURED_COLOR },
      trackStyle: { backgroundColor: TRACK_COLOR },
    });
  });

  it('uses the decided colours for the shared swatch and the track', () => {
    expect(toneStyle(colors, 'shared')).toEqual({
      backgroundColor: colors.secondary.yellowMedium,
      backgroundImage: HATCH,
    });
    expect(TRACK_COLOR).toBe('rgba(255,255,255,0.10)');
    expect(TRACK_HATCH).toBe(
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 3px, transparent 3px 6px)'
    );
  });

  it('uses the decided colours for the frame of the graph', () => {
    expect(GRAPH_BACKGROUND).toBe('rgba(0,0,0,0.25)');
    expect(GRAPH_BORDER).toBe('1px solid rgba(255,255,255,0.08)');
  });

  // WCAG 1.4.11 asks 3:1 for the parts of a graphic that carry meaning, and
  // the stripes are the only mark of a shared miss. On a shared red bar of
  // 3 px, the stripes that show are those of the track.
  it('draws the hatch stripes at 3:1 or more against the fill and the track', () => {
    const sharedBar = (included: number) =>
      barVisual(colors, inclusionWindow(1, { included, shared: true }));
    const fills = {
      'amber bar': sharedBar(7).style,
      'red bar': sharedBar(0).style,
      'legend swatch': toneStyle(colors, 'shared'),
    };
    const track = sharedBar(0).trackStyle;
    const ratios: Record<string, number> = {};
    for (const [name, style] of Object.entries(fills)) {
      const fill = paint(style.backgroundColor).rgb;
      ratios[name] = stripeContrast(fill, style.backgroundImage);
    }
    for (const page of PAGES) {
      const graph = over(paint(page).rgb, paint(GRAPH_BACKGROUND));
      const empty = over(graph, paint(track.backgroundColor));
      ratios[`track on ${page}`] = stripeContrast(empty, track.backgroundImage);
    }
    expect(
      Object.entries(ratios)
        .filter(([, ratio]) => ratio < 3)
        .map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}:1`)
    ).toEqual([]);
  });
});
