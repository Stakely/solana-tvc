'use client';

import React, { FC, ReactNode, useState } from 'react';
import { Pixel } from '@/app/components/utils/Measures.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Icon, Text } from '@/app/components';

type ExternalLinkProps = {
  /**
   * The text label of the link to be displayed.
   */
  label: string;

  /**
   * The destination URL the link points to.
   * It will open in a new browser tab.
   */
  to: string;

  /**
   * The base color of the external link icon.
   * If not provided, a primary theme color will be used.
   */
  iconColor?: string;

  /**
   * The color of the icon when hovered.
   * If not provided, a different primary theme color will be used.
   */
  iconHoverColor?: string;

  /**
   * The size of the icon displayed next to the link.
   * Accepts any valid CSS size unit (e.g., '10px', '1rem').
   */
  iconSize?: Pixel;

  /**
   * The typography variant to be used for the link label.
   * Can be either 'littleBody' or 'body1', depending on the desired style.
   */
  textVariant?: 'littleBody' | 'body1';

  /**
   * The base color of the external lin text.
   * If not provided, a background color will be used.
   */
  textColor?: string;

  /**
   * The color of the text when hovered.
   * If not provided, a different primary theme color will be used.
   */
  textHoverColor?: string;

  /**
   * The color of the text when clicked.
   * If not provided, a different primary theme color will be used.
   */
  textClickedColor?: string;

  iconClickedColor?: string;
};

/**
 * `ExternalLink` is a styled link component that opens a URL in a new browser tab.
 * It visually includes a label and an external link icon (↗), with dynamic hover
 * and click styles for both text and icon.
 *
 * This component is useful for directing users to resources outside of your application
 * while maintaining a polished and interactive design.
 *
 * ### Usage
 * ```tsx
 * <ExternalLink
 *   label="Visit GitHub"
 *   to="https://github.com"
 * />
 *
 * <ExternalLink
 *   label="Docs"
 *   to="https://example.com"
 *   iconSize="12px"
 *   iconHoverColor="#FF8C00"
 *   textColor="#999"
 *   textHoverColor="#FF8C00"
 *   textClickedColor="#FF4500"
 *   textVariant="body1"
 * />
 * ```
 */
export const ExternalLink: FC<ExternalLinkProps> = ({
  label,
  to,
  iconSize = '10px',
  iconColor,
  iconHoverColor,
  textVariant = 'littleBody',
  textColor,
  textHoverColor,
  textClickedColor,
  iconClickedColor,
}: ExternalLinkProps): ReactNode => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isClicked, setIsClicked] = useState<boolean>(false);

  const { colors } = useTheme();

  const getColor = (): string => {
    if (isClicked) {
      return textClickedColor ?? colors.primary['02'];
    }

    if (isHovered) {
      return textHoverColor ?? colors.background['00'];
    }

    return textColor ?? colors.background['00'];
  };

  const getIconColor = (): string => {
    if (isClicked) {
      return iconClickedColor ?? colors.primary['02'];
    }

    if (isHovered) {
      return iconHoverColor ?? colors.primary['02'];
    }

    return iconColor ?? colors.primary['02'];
  };

  const onLinkClicked = () => {
    setIsClicked(true);
    window.open(to, '_blank');
    return;
  };

  return (
    <span
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onLinkClicked()}
      style={{
        cursor: 'pointer',
        position: 'relative',
        display: 'inline-block',
        paddingBottom: '4px',
      }}
    >
      <style>
        {`
      .underline-animation::after {
        content: "";
        position: absolute;
        left: 0;
        bottom: 0;
        height: 2px;
        width: 0;
        background-color: ${colors.primary['02']};
        transition: width 0.2s ease-in-out;
      }

      .underline-animation:hover::after {
        width: 100%;
      }
    `}
      </style>
      <div
        className={'underline-animation'}
        style={{ display: 'flex', gap: '5px', alignItems: 'center' }}
      >
        <Text variant={textVariant} content={label} color={getColor()} />
        <div style={{ cursor: 'pointer' }}>
          <Icon
            name={'arrowUpRight'}
            size={iconSize}
            color={getIconColor()}
            clickable
          />
        </div>
      </div>
    </span>
  );
};
