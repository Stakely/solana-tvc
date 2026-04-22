import React, { FC, ReactNode } from 'react';
import { Pixel } from '@/app/components/utils/Measures.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Icon, Text } from '@/app/components';

export type SpinnerProps = {
  /** A set of styles for the spinner */
  variant?: 'primary' | 'secondary' | 'logo';

  /** The size of the spinner */
  size?: Pixel;

  /** The size of the stroke */
  strokeWidth?: Pixel;

  /** Text to be displayed under the spinner */
  text?: string;
};

/**
 * `Spinner` is a visual loading indicator used to represent background activity or
 * asynchronous operations. It supports different styles, sizes, and optional text
 * displayed below the spinner.
 *
 * ### Usage
 * ```tsx
 * // Default spinner
 * <Spinner />
 *
 * // Spinner with text
 * <Spinner text="Loading" />
 *
 * // Logo variant spinner
 * <Spinner variant="logo" size="60px" />
 * ```
 */
export const Spinner: FC<SpinnerProps> = ({
  variant = 'primary',
  size,
  strokeWidth,
  text,
}: SpinnerProps): ReactNode => {
  const { colors } = useTheme();

  const getColor = (): string => {
    if (variant === 'primary') {
      return colors.primary['01'];
    }

    if (variant === 'secondary') {
      return colors.primary['02'];
    }

    return colors.primary['02'];
  };

  const getSize = (): Pixel => {
    if (variant === 'logo') {
      return size ?? '50px';
    }

    return size ?? '24px';
  };

  const getStrokeWidth = (): Pixel => {
    if (variant === 'logo') {
      return strokeWidth ?? '4px';
    }

    return strokeWidth ?? '3px';
  };

  const getLogoSize = (): Pixel => {
    const rawSize = size ?? '50px';
    const numericValue = parseInt(rawSize, 10);

    // Resta 4 y devuelve como string con 'px'
    const adjustedSize = Math.max(numericValue - 20, 0);

    return `${adjustedSize}px`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'center',
      }}
    >
      <div
        data-testid="spinner"
        style={{
          width: `${getSize()}`,
          height: `${getSize()}`,
          border: `${getStrokeWidth()} solid ${colors.background['00']}`,
          borderTop: `${getStrokeWidth()} solid ${getColor()}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {variant === 'logo' && (
          <div>
            <div>
              <Icon name={'logo'} size={getLogoSize()} />
            </div>
          </div>
        )}
      </div>
      {text && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text content={text} />
          <span className="spinner-dot">.</span>
          <span className="spinner-dot">.</span>
          <span className="spinner-dot">.</span>
        </div>
      )}
    </div>
  );
};
