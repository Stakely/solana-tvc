import React, { FC, ReactNode } from 'react';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { getRgb } from '@/app/components/theme/design-system.ts';
import {
  Percentage,
  Pixel,
  ViewportHeight,
  ViewportWidth,
} from '@/app/components/utils/Measures.ts';

type SurfaceProps = {
  width?: Percentage | ViewportWidth | Pixel | 'auto';
  height?: Percentage | ViewportHeight | Pixel | 'auto';
  maxWidth?: Percentage | ViewportWidth | Pixel | 'auto';
  maxHeight?: Percentage | ViewportHeight | Pixel | 'auto';
  padding?: string;
  margin?: string;
  invisible?: boolean;
  children?: ReactNode;
  /**
   * Background color of the surface.
   * If not provided, the default background color from the theme will be used.
   */
  background?: string;

  /**
   * Opacity level for the background color.
   * Value should be between 0 (fully transparent) and 1 (fully opaque).
   */
  opacity?: number;

  /**
   * Whether to render a border around the surface.
   * The color of the border is derived from the theme.
   */
  border?: boolean;

  /**
   * Specifies the color of the border.
   *
   * This variable is optional and can be used to set the color of the border
   * in string format. The color can be defined using valid CSS color values,
   * such as color names, hexadecimal, RGB, or HSL values.
   */
  borderColor?: string;

  /**
   * Defines the border radius of the surface.
   * - 'primary' applies full rounded corners.
   * - 'secondary' applies rounded corners only at the top.
   */
  radiusVariant?: 'primary' | 'secondary';

  /**
   * Whether the surface should grow to fill available space
   * when used in a flex container.
   */
  grow?: boolean;

  /**
   * Applies a subtle box shadow to create a visual elevation effect.
   * Useful for distinguishing the surface from the background.
   */
  elevated?: boolean;
};

/**
 * `Surface` is a versatile container that provides a background, optional border,
 * border-radius variants, and an optional elevation shadow.
 * It is ideal for card-like elements or sections that need to stand out from the
 * page background while still respecting theme colors.
 *
 * Internally it’s built on a simple `<div>` and accepts all layout props from
 * `BoxProps`, plus additional styling flags such as `background`, `opacity`,
 * `border`, `radiusVariant`, and `elevated`.
 *
 *
 * ### Usage
 * ```tsx
 * // Basic surface with default theme background
 * <Surface padding="20px">
 *   <p>Content on a surface</p>
 * </Surface>
 *
 * // Elevated, semi-transparent surface with custom border
 * <Surface
 *   background="#1e1e2f"
 *   opacity={0.8}
 *   border
 *   borderColor="#4DBE6E"
 *   radiusVariant="secondary"
 *   padding="30px"
 *   elevated
 * >
 *   <Heading>Modal Body</Heading>
 * </Surface>
 * ```
 */
export const Surface: FC<SurfaceProps> = ({
  width = '100%',
  height = '100%',
  maxWidth = '100%',
  maxHeight = '100%',
  padding = '0px',
  background,
  opacity = 1,
  border = false,
  borderColor,
  radiusVariant = 'primary',
  elevated = true,
  children,
}: SurfaceProps): ReactNode => {
  const { colors, borderRadius } = useTheme();
  const rgb = getRgb(background ?? colors.background['07']);
  const borderRgb = getRgb(borderColor ?? colors.background['02']);

  return (
    <div
      style={{
        padding: padding,
        maxWidth,
        maxHeight,
        width,
        height,
        boxSizing: 'border-box',
        border: border
          ? `1px solid rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, 1)`
          : 'none',
        backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`,
        borderRadius:
          radiusVariant === 'primary'
            ? `${borderRadius.surface}`
            : `${borderRadius.surface} ${borderRadius.surface} 0px 0px`,
        overflowY: 'auto',
        boxShadow: `0px 4px 12px rgba(0, 0, 0, ${elevated ? 0.4 : 0})`,
      }}
    >
      {children}
    </div>
  );
};
