import React, { FC, ReactNode } from 'react';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Pixel } from '@/app/components/utils/Measures.ts';

type AvatarProps = {
  /** The full name from which the initials will be generated. The color of the avatar is deterministically determined based on this name */
  name: string;

  /** The size of the avatar in pixels. */
  size?: Pixel;
};

/**
 * `Avatar` is a circular visual identifier that displays the initials of a given name.
 *
 * It is useful as a placeholder for user profile images or when representing people
 * in a list, dashboard, or chat UI.
 *
 * The background and text color are deterministically generated from the `name` to ensure
 * consistent color assignment across renders.
 *
 *
 * ### Usage
 * ```tsx
 * <Avatar name="Alice Johnson" />
 *
 * <Avatar name="Satoshi Nakamoto" size="80px" />
 * ```
 */
export const Avatar: FC<AvatarProps> = ({
  name,
  size = '130px',
}: AvatarProps): ReactNode => {
  const theme = useTheme();
  const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'other'];

  const getColor = (): string => {
    const sum = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };

  const getBackgroundColor = (): string => {
    const color = getColor();

    if (color === 'red') {
      return theme.colors.secondary.redLow;
    }

    if (color === 'blue') {
      return theme.colors.secondary.blueLow;
    }

    if (color === 'green') {
      return theme.colors.secondary.greenLow;
    }

    if (color === 'yellow') {
      return theme.colors.secondary.yellowLow;
    }

    if (color === 'orange') {
      return theme.colors.secondary.orangeLow;
    }

    return theme.colors.background['01'];
  };

  const getTextColor = (): string => {
    const color = getColor();

    if (color === 'red') {
      return theme.colors.secondary.redHigh;
    }

    if (color === 'blue') {
      return theme.colors.secondary.blueHigh;
    }

    if (color === 'green') {
      return theme.colors.secondary.greenHigh;
    }

    if (color === 'yellow') {
      return theme.colors.secondary.yellowHigh;
    }

    if (color === 'orange') {
      return theme.colors.primary['02'];
    }

    return theme.colors.primary['01'];
  };

  const getInitials = (): string => {
    const parts = name.split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  };

  const avatarStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: getBackgroundColor(),
    color: getTextColor(),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: `calc(${size} / 2.5)`,
    userSelect: 'none',
    fontFamily: 'Plus Jakarta Sans',
  };

  return <div style={avatarStyle}>{getInitials()}</div>;
};
