// WCAG 2.x contrast of CSS colours, shared by the colour tests.

export type Rgb = [number, number, number];
export type Paint = { rgb: Rgb; alpha: number };

// A CSS colour: #rrggbb, rgb() or rgba(), as the code writes it or as jsdom
// reports an inline style.
export function paint(css: string | undefined): Paint {
  const value = String(css).replace(/\s/g, '');
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) {
    const [r, g, b] = hex.slice(1).map((part) => parseInt(part, 16));
    return { rgb: [r, g, b], alpha: 1 };
  }
  const fn = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/.exec(value);
  if (!fn) throw new Error(`No colour in "${String(css)}"`);
  const [r, g, b] = fn.slice(1, 4).map(Number);
  return { rgb: [r, g, b], alpha: fn[4] === undefined ? 1 : Number(fn[4]) };
}

// The colour of the stripes of a hatch: the first rgba() of its repeating
// gradient (the gaps between the stripes are transparent).
export function stripePaint(css: string | undefined): Paint {
  const stripe = /rgba\([^)]*\)/.exec(String(css));
  if (!stripe) throw new Error(`No rgba() stripe in "${String(css)}"`);
  return paint(stripe[0]);
}

// Paints a colour over an opaque one, blending in sRGB as browsers do.
export function over(base: Rgb, { rgb, alpha }: Paint): Rgb {
  const [r, g, b] = base.map(
    (value, i) => rgb[i] * alpha + value * (1 - alpha)
  );
  return [r, g, b];
}

// WCAG 2.x relative luminance and contrast ratio of opaque colours.
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(one: Rgb, other: Rgb): number {
  const [a, b] = [luminance(one), luminance(other)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
