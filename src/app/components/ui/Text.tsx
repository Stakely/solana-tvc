import { FC, ReactNode } from 'react';
import React from 'react';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Pixel, Rem } from '@/app/components/utils/Measures.ts';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body1'
  | 'body2'
  | 'littleBody'
  | 'largeKeyNumber'
  | 'mediumKeyNumber'
  | 'littleKeyNumber'
  | 'logo';

export type TextProps = {
  /** The variant (set of styles) of the text */
  variant?: TextVariant;

  /** The content of the text */
  content?: string;

  /** Whether the text will be in uppercase */
  uppercase?: boolean;

  /** The weight of the font to be displayed (100 - 900) **/
  weight?: number;

  /** The color of the font to be displayed **/
  color?: string;

  /** The text alignment */
  align?: 'left' | 'center' | 'right';

  /** Whether the text is in italic style. */
  italic?: boolean;

  /** Whether the text has a line through */
  lineThrough?: boolean;

  /** Whether the text is underlined */
  underline?: boolean;

  /** Forces the font size **/
  forceSize?: Pixel | Rem;

  /** Forces the line height */
  forceLineHeight?: number;

  /** Alt message to be displayed when hovered */
  alt?: string;
};

/**
 * `Text` is the core typography component that provides standardized font styles
 * throughout the app. It supports different variants (e.g., `h1`, `body1`, `keyNumber`)
 * and various modifiers such as weight, alignment, size overrides, and inline formatting.
 *
 * ## Features
 * - Predefined `variant`s based on your design system
 * - Dynamic styles (weight, italic, underline, etc.)
 * - Template support for `<b>bold</b>` and `<l:url>link</l>` syntax
 * - Responsive to theme colors and font definitions
 *
 * ## Example (default body text)
 * ```tsx
 * <Text content="This is body text" />
 * ```
 *
 * ## Example (uppercase bold H2)
 * ```tsx
 * <Text variant="h2" content="Section Title" uppercase weight={700} />
 * ```
 *
 * ## Example (bold + links in content string)
 * ```tsx
 * <Text content="Click <l:https://google.com>here</l> or read the <b>manual</b>." />
 * ```
 *
 * ## Example (custom size + color)
 * ```tsx
 * <Text content="Custom" forceSize="18px" color="#FF5722" />
 * ```
 */
export const Text: FC<TextProps> = ({
  variant = 'body1',
  content = '',
  uppercase = false,
  weight,
  align = 'left',
  italic = false,
  alt = '',
  lineThrough = false,
  underline = false,
  forceSize,
  forceLineHeight,
  color,
}: TextProps): ReactNode => {
  const { colors, fonts } = useTheme();

  const getWeight = (): number => {
    return fonts[variant as keyof typeof fonts].weight;
  };

  const getSize = (): Rem | Pixel => {
    if (forceSize) {
      return forceSize;
    }

    return fonts[variant as keyof typeof fonts].size;
  };

  const getLineHeight = (): Rem | number => {
    if (forceLineHeight) {
      return forceLineHeight;
    }

    return fonts[variant as keyof typeof fonts].lineHeight;
  };

  const getFontFamily = (): string => {
    return fonts[variant as keyof typeof fonts].font;
  };

  const getColor = (): string => {
    if (color) {
      return color;
    }

    return colors.background['00'];
  };

  const parseColor = (text: string, keyPrefix: string): ReactNode[] => {
    const result: ReactNode[] = [];
    const colorRegex = /<c:(.*?)>(.*?)<\/c>/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let matchIndex = 0;

    while ((match = colorRegex.exec(text)) !== null) {
      const [fullMatch, colorValue, inner] = match;

      if (match.index > lastIndex) {
        const before = text.slice(lastIndex, match.index);
        result.push(
          ...parseLinksAndBold(before, `${keyPrefix}-before-${matchIndex}`)
        );
      }

      result.push(
        <span
          key={`${keyPrefix}-color-${matchIndex}`}
          style={{ color: String(colorValue).trim() }}
        >
          {parseLinksAndBold(inner, `${keyPrefix}-colorinner-${matchIndex}`)}
        </span>
      );

      lastIndex = match.index + fullMatch.length;
      matchIndex++;
    }

    if (lastIndex < text.length) {
      const rest = text.slice(lastIndex);
      result.push(...parseLinksAndBold(rest, `${keyPrefix}-rest`));
    }

    return result;
  };

  const parseBold = (text: string, keyPrefix: string): ReactNode[] => {
    const result: ReactNode[] = [];
    const boldRegex = /<b>(.*?)<\/b>/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let matchIndex = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      result.push(
        <strong key={`${keyPrefix}-${matchIndex}`}>{match[1]}</strong>
      );

      lastIndex = match.index + match[0].length;
      matchIndex++;
    }

    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  };

  const parseLinksAndBold = (text: string, keyPrefix: string): ReactNode[] => {
    const linkRegex = /<l:(.*?)>(.*?)<\/l>/g;
    const parts: ReactNode[] = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
      const [fullMatch, url, linkText] = match;

      if (match.index > lastIndex) {
        const before = text.slice(lastIndex, match.index);
        parts.push(...parseBold(before, `${keyPrefix}-bold-${lastIndex}`));
      }

      parts.push(
        <a
          key={`${keyPrefix}-link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'underline', color: 'inherit' }}
        >
          {linkText}
        </a>
      );

      lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex);
      parts.push(...parseBold(remaining, `${keyPrefix}-bold-rest`));
    }

    return parts;
  };

  const parseTemplate = (raw: string): ReactNode[] => {
    const lines = raw.split('\n');
    const out: ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      out.push(...parseColor(line, `line-${lineIndex}`));

      if (lineIndex < lines.length - 1) {
        out.push(<br key={`br-${lineIndex}`} />);
      }
    });

    return out;
  };

  return (
    <span
      title={alt}
      style={{
        fontWeight: weight ? weight : getWeight(),
        fontSize: getSize(),
        lineHeight: getLineHeight(),
        fontFamily: getFontFamily(),
        textTransform: uppercase ? 'uppercase' : 'none',
        color: getColor(),
        textAlign: align,
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: lineThrough
          ? 'line-through'
          : underline
            ? 'underline'
            : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      {parseTemplate(content)}
    </span>
  );
};
