import { contrast, over, paint, stripePaint } from './contrast.ts';

const HATCH_LIKE =
  'repeating-linear-gradient(45deg, rgba(0,0,0,0.6) 0 3px, transparent 3px 6px)';

describe('contrast helpers', () => {
  it('reads #rrggbb, rgb() and rgba() alike', () => {
    expect(paint('#F75D5C')).toEqual({ rgb: [247, 93, 92], alpha: 1 });
    expect(paint('rgb(247, 93, 92)')).toEqual({ rgb: [247, 93, 92], alpha: 1 });
    expect(paint('rgba(255,255,255,0.35)')).toEqual({
      rgb: [255, 255, 255],
      alpha: 0.35,
    });
  });

  it('refuses what is not a single colour', () => {
    expect(() => paint(undefined)).toThrow('No colour in "undefined"');
    expect(() => paint('')).toThrow('No colour in ""');
    expect(() => paint(HATCH_LIKE)).toThrow('No colour in');
  });

  it('takes the stripes of a hatch from its first rgba()', () => {
    expect(stripePaint(HATCH_LIKE)).toEqual({ rgb: [0, 0, 0], alpha: 0.6 });
    expect(() => stripePaint('transparent')).toThrow('No rgba() stripe in');
  });

  it('blends and measures as WCAG 2.x does', () => {
    expect(over([0, 0, 0], paint('rgba(255,255,255,0.5)'))).toEqual([
      127.5, 127.5, 127.5,
    ]);
    expect(contrast([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    // #767676 on white, the lightest grey that passes AA for small text.
    expect(contrast([0x76, 0x76, 0x76], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });
});
