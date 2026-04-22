'use client';

import React, { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { Pixel, Rem } from '@/app/components/utils/Measures.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Icon, Text } from '@/app/components';

export type AccordionProps = {
  /** A visual style for the accordion */
  variant?: 'primary' | 'transparent';

  /** The summary text or node that is always visible */
  summary: string | ReactNode;

  /** The content shown when the accordion is expanded */
  children: ReactNode | string;

  /** Overrides the font size of the summary when `summary` is a string */
  summaryFontSize?: Pixel | Rem;

  /** If true, toggles the accordion only when clicking the icon */
  onlyCollapseOnIcon?: boolean;

  /** If true, the accordion starts in collapsed state */
  defaultCollapse?: boolean;

  /** Overrides the icon color */
  iconColor?: string;

  /** Overrides the border color of the accordion */
  borderColor?: string;

  /** Overrides the background color of the accordion */
  backgroundColor?: string;
};

/**
 * `Accordion` is a collapsible container component that reveals or hides its content
 * when toggled by the user. It supports two visual styles: `'primary'` and `'transparent'`,
 * and can optionally restrict toggling to icon clicks only.
 *
 * This component supports animated height transitions and manages internal open/close state.
 * It can be used for FAQs, expandable cards, or settings sections where content needs to be hidden by default.
 *
 *
 *
 * ### Usage:
 * ```tsx
 * <Accordion summary="Advanced Settings">
 *   <SettingsForm />
 * </Accordion>
 *
 * <Accordion
 *   summary="Details"
 *   variant="transparent"
 *   onlyCollapseOnIcon
 *   defaultCollapse
 * />
 * ```
 */
export const Accordion: FC<AccordionProps> = ({
  variant = 'primary',
  iconColor,
  borderColor,
  backgroundColor,
  summary,
  summaryFontSize,
  children,
  onlyCollapseOnIcon = false,
  defaultCollapse = false,
}: AccordionProps) => {
  const { colors, borderRadius } = useTheme();
  const [isOpen, setOpen] = useState<boolean>(defaultCollapse);
  const [isHover, setHover] = useState<boolean>(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<string | number>(isOpen ? 'auto' : 0);

  useEffect(() => {
    if (isOpen) {
      const scrollHeight = contentRef.current?.scrollHeight || 0;
      setHeight(scrollHeight);
      const timeout = setTimeout(() => setHeight('auto'), 300);
      return () => clearTimeout(timeout);
    } else {
      const currentHeight = contentRef.current?.scrollHeight || 0;
      setHeight(currentHeight);
      requestAnimationFrame(() => {
        setHeight(0);
      });
    }
  }, [isOpen]);

  const getIconColor = () => {
    if (onlyCollapseOnIcon && isOpen) {
      return colors.primary['02'];
    }

    if (iconColor) {
      return iconColor;
    }

    return colors.background['03'];
  };

  const getSummary = (): ReactNode => {
    if (typeof summary === 'string') {
      return (
        <Text
          weight={700}
          content={summary}
          underline={isHover}
          forceSize={summaryFontSize}
        />
      );
    }

    return summary;
  };

  const getRotation = (): number => {
    if (isOpen) {
      return 90;
    }

    return 0;
  };

  const getBackgroundColor = (): string => {
    if (backgroundColor) {
      return backgroundColor;
    }

    if (variant === 'transparent') {
      return 'transparent';
    }

    return colors.background['07'];
  };

  const getPadding = (): string => {
    if (variant === 'transparent') {
      return '0';
    }

    return '20px 30px';
  };

  const getBorder = (): string => {
    if (borderColor) {
      return `2px solid ${borderColor}`;
    }

    if (variant === 'transparent') {
      return 'none';
    }

    return `2px solid ${colors.background['03']}`;
  };

  const getChildren = () => {
    if (typeof children === 'string') {
      return <Text content={children} color={colors.background['02']} />;
    }

    return children;
  };

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: getPadding(),
        borderRadius: borderRadius.accordion,
        border: getBorder(),
        background: getBackgroundColor(),
        transition: 'height 0.3s ease',
      }}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        data-testid="accordion-summary"
        style={{
          width: '100%',
          cursor: 'pointer',
          background: getBackgroundColor(),
          boxSizing: 'border-box',
        }}
        onClick={() => {
          if (onlyCollapseOnIcon) {
            return;
          }
          setOpen((prev) => !prev);
        }}
      >
        <div
          className={`'w-full h-full gap-10 items-center ${variant === 'transparent' ? 'space-between' : 'justify-start'}`}
        >
          {variant === 'transparent' && (
            <div
              onClick={() => {
                if (onlyCollapseOnIcon) {
                  setOpen((prev) => !prev);
                }
              }}
            >
              <Icon
                clickable
                name={'rightArrow'}
                size={'18px'}
                rotation={getRotation()}
                color={getIconColor()}
              />
            </div>
          )}
          {getSummary()}
          {variant === 'primary' && (
            <div
              onClick={() => {
                if (onlyCollapseOnIcon) {
                  setOpen((prev) => !prev);
                }
              }}
            >
              <Icon
                clickable
                name={'rightArrow'}
                size={'20px'}
                rotation={getRotation()}
                color={getIconColor()}
              />
            </div>
          )}
        </div>
      </div>
      <div
        ref={contentRef}
        style={{
          height: height,
          overflow: 'hidden',
          transition: 'height 0.3s ease',
          marginTop: isOpen ? '10px' : '0',
        }}
      >
        {getChildren()}
      </div>
    </div>
  );
};
