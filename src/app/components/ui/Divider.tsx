import React, { FC, ReactNode } from 'react';
import { Percentage, Pixel } from '@/app/components/utils/Measures.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';

type DividerProps = {
  /**
   * Orientation of the divider.
   * - 'horizontal' creates a line that grows along the X axis (left to right).
   * - 'vertical' creates a line that grows along the Y axis (top to bottom).
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';

  /**
   * Color of the divider.
   * If not provided, a default theme-based color will be used depending on the orientation.
   */
  color?: string;

  /**
   * Thickness of the divider.
   * For horizontal orientation, it represents height.
   * For vertical orientation, it represents width.
   * Accepts any valid CSS size value (e.g., '2px', '0.5rem').
   */
  thickness?: Pixel;

  /**
   * Length of the divider along the main axis.
   * - For horizontal: sets the width.
   * - For vertical: sets the height.
   * If not set, defaults to 100% (fills container).
   */
  length?: Pixel | Percentage;

  /**
   * Opacity of the divider, from 0 (fully transparent) to 1 (fully opaque).
   * @default 1
   */
  opacity?: number;
};

/**
 * `Divider` is a layout utility component used to visually separate content either
 * horizontally or vertically. It supports full customization of color, thickness,
 * length, and opacity.
 *
 * Common use cases include section breaks, item separators in menus or layouts,
 * and visual cues for grouped elements.
 *
 * ### Usage
 * ```tsx
 * // A horizontal divider
 * <Divider />
 *
 * // A vertical divider with custom color and opacity
 * <Divider orientation="vertical" color="#4DBE6E" opacity={0.3} />
 *
 * // A short, thick horizontal divider
 * <Divider thickness="5px" length="80px" />
 * ```
 */
export const Divider: FC<DividerProps> = ({
  orientation = 'horizontal',
  color,
  thickness,
  opacity = 1,
  length,
}: DividerProps): ReactNode => {
  const { colors } = useTheme();

  const getColor = (): string => {
    if (color) return color;
    return orientation === 'horizontal'
      ? colors.background['07']
      : colors.background['03'];
  };

  const getThickness = (): Pixel => {
    if (thickness) return thickness;
    return orientation === 'vertical' ? '11px' : '2px';
  };

  return (
    <div
      data-testid="divider"
      style={{
        width:
          orientation === 'horizontal' ? (length ?? '100%') : getThickness(),
        height:
          orientation === 'horizontal' ? getThickness() : (length ?? '100%'),
        backgroundColor: getColor(),
        border: 'none',
        opacity,
      }}
    />
  );
};
