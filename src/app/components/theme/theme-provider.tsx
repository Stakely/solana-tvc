'use client';

import React, { createContext, FC, ReactNode, useContext } from 'react';
import { Theme } from './theming';
import { StakelyTheme } from './design-system';
import { deepMerge, DeepPartial } from '../utils/Merge';

const ThemeContext = createContext<Theme | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  theme?: DeepPartial<Theme>;
};

export const ThemeProvider: FC<ThemeProviderProps> = ({
  children,
  theme: customTheme,
}) => {
  const theme = customTheme
    ? deepMerge(StakelyTheme, customTheme)
    : StakelyTheme;

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme() must be used within ThemeProvider');
  }

  return theme;
};
