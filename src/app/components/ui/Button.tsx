'use client';

import React, { FC, ReactNode, useState } from 'react';
import { Icon as IconName } from '../assets/icons';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { getRgb } from '@/app/components/theme/design-system.ts';
import { Button as MUIButton, ClickAwayListener, Tooltip } from '@mui/material';
import { Icon, Spinner } from '@/app/components';

export type ButtonProps = {
  /** The message inside the button */
  label?: string;

  /** Overrides the background color */
  background?: string;

  /** Overrides the text color */
  textColor?: string;

  /** A set of styles for the button */
  variant?: 'primary' | 'secondary' | 'shiny';

  /** Shows the button with transparent background but with borders */
  outlined?: boolean;

  /** Reduce the button size */
  reduced?: boolean;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Whether the button is in loading state */
  loading?: boolean;

  /** Component with an icon to be rendered */
  icon?: IconName;

  /** The position of the icon */
  iconPosition?: 'start' | 'end';

  iconColor?: string;

  /** Function to be called when the button is clicked */
  onClick?: () => void;

  /** Shows a tooltip message when the button is clicked */
  tooltip?: string;

  /** The color of the button border */
  borderColor?: string;

  /** The color of the button when hovering */
  onHoverColor?: string;

  /** The color of the button text when hovering */
  onHoverTextColor?: string;
};

/**
 * `Button` is a highly customizable UI component that supports multiple visual variants,
 * icons, loading states, tooltips, and interaction styles (outlined, disabled, reduced, etc).
 *
 * It wraps MUI’s `Button` and adds consistent branding styles, dynamic colors from the theme,
 * and behavior such as loading spinners or temporary tooltips on click.
 *
 * Useful for any type of primary, secondary, or CTA button throughout the application.
 *
 *
 * ### Usage
 * ```tsx
 * <Button label="Submit" onClick={handleSubmit} />
 *
 * <Button
 *   variant="secondary"
 *   label="Retry"
 *   icon="refresh"
 *   iconPosition="start"
 *   tooltip="Resend request"
 *   onClick={() => retry()}
 * />
 *
 * <Button
 *   label="Processing..."
 *   loading
 *   disabled
 *   variant="shiny"
 * />
 * ```
 */
export const Button: FC<ButtonProps> = ({
  label = '',
  variant = 'primary',
  background,
  textColor,
  outlined = false,
  reduced = false,
  disabled = false,
  loading = false,
  icon = undefined,
  iconPosition = 'start',
  onClick = () => {},
  tooltip,
  borderColor,
  iconColor,
  onHoverColor,
  onHoverTextColor,
}: ButtonProps): ReactNode => {
  const { colors, borderRadius } = useTheme();
  const [isTooltipVisible, setIsTooltipVisible] = useState<boolean>(false);
  const [isHovering, setHovering] = useState(false);

  const getBackgroundColor = (): string => {
    if (background) {
      return background;
    }

    if (outlined) {
      return colors.transparent;
    }

    if (disabled) {
      return colors.background['03'];
    }

    if (variant === 'primary') {
      return colors.primary['02'];
    }

    return colors.primary['01'];
  };

  const getPadding = (): string => {
    if (reduced) {
      return '6px 16px';
    }

    if (variant === 'primary' || outlined) {
      return '15px 30px';
    }

    return '10px 25px';
  };

  const getBorderColor = (): string => {
    if (borderColor) {
      return borderColor;
    }

    if (background) {
      return background;
    }

    if (outlined && disabled) {
      return colors.background['03'];
    }

    if (outlined && variant === 'secondary') {
      return colors.primary['01'];
    }

    if (variant === 'primary') {
      return colors.primary['02'];
    }

    return colors.background['00'];
  };

  const getTextColor = (): string => {
    if (textColor) {
      return textColor;
    }

    if (outlined) {
      if (disabled) {
        return colors.background['02'];
      }

      if (variant === 'primary') {
        return colors.primary['02'];
      }

      if (outlined && variant === 'secondary') {
        return colors.primary['01'];
      }

      return colors.background['00'];
    }

    return colors.background['00'];
  };

  const getSpinnerVariant = (): 'primary' | 'secondary' => {
    if (outlined) {
      return 'secondary';
    }

    if (variant === 'shiny') {
      return 'secondary';
    }

    return variant;
  };

  const borderColorRgb = getRgb(getBorderColor());

  const handleClick = () => {
    if (tooltip) {
      setIsTooltipVisible(true);
      setTimeout(() => setIsTooltipVisible(false), 2000);
    }
    onClick();
  };

  const getButtonHoverColor = (): string => {
    if (onHoverColor) {
      return onHoverColor;
    }

    if (outlined) {
      return `rgba(${borderColorRgb.r}, ${borderColorRgb.g}, ${borderColorRgb.b}, 0.1)`;
    }

    if (variant === 'primary') {
      return colors.primary['01'];
    }

    if (variant === 'secondary') {
      return colors.primary['02'];
    }

    return colors.primary['02'];
  };

  const getTextHoverColor = (): string => {
    if (onHoverTextColor) {
      return onHoverTextColor;
    }

    if (variant === 'primary') {
      return colors.primary['02'];
    }

    if (variant === 'secondary') {
      return colors.primary['01'];
    }

    return colors.background['00'];
  };

  const getIconColor = (): string => {
    if (iconColor) {
      return iconColor;
    }

    if (isHovering) {
      return getTextHoverColor();
    }

    return getTextColor();
  };

  return (
    <ClickAwayListener onClickAway={() => setIsTooltipVisible(false)}>
      <Tooltip title={tooltip} open={isTooltipVisible}>
        <MUIButton
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          variant={outlined ? 'outlined' : 'contained'}
          onClick={handleClick}
          disabled={disabled}
          sx={{
            transition: 'all ease-in-out 300ms',
            color: getTextColor(),
            borderRadius: borderRadius.button,
            backgroundColor: getBackgroundColor(),
            background:
              variant !== 'shiny'
                ? 'auto'
                : 'radial-gradient(60.26% 100.81% at 64.71% -33.81%, #4DBE6E 0%, rgba(28, 53, 135, 0.00) 100%), radial-gradient(272.95% 245.28% at 79.08% 145.14%, #FF7748 0%, #192F74 64.5%), #000',
            width: 'fit-content',
            height: 'fit-content',
            padding: getPadding(),
            '&.Mui-disabled': {
              backgroundColor: getBackgroundColor(),
              borderColor: getBorderColor(),
              color: getTextColor(),
              fontFamily: 'Plus Jakarta Sans',
            },
            border: outlined ? `1px solid ${getBorderColor()}` : 'none',
            '&:hover': {
              background: getButtonHoverColor(),
              backgroundColor: getButtonHoverColor(),
              color: getTextHoverColor(),
            },
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              justifyContent: 'center',
              visibility: loading ? 'hidden' : 'visible',
            }}
          >
            {icon && iconPosition === 'start' && (
              <Icon name={icon} size={'18px'} color={getIconColor()} />
            )}
            <span
              style={{
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: 700,
                fontSize: '1rem',
                lineHeight: '1.26rem',
                textTransform: 'none',
              }}
            >
              {label}
            </span>
            {icon && iconPosition === 'end' && (
              <Icon name={icon} size={'18px'} color={getIconColor()} />
            )}
          </div>
          {loading && (
            <div style={{ position: 'absolute' }}>
              <Spinner size={'16px'} variant={getSpinnerVariant()} />
            </div>
          )}
        </MUIButton>
      </Tooltip>
    </ClickAwayListener>
  );
};
