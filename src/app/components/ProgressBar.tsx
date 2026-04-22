'use client';

import React from 'react';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Tooltip } from '@/app/components/ui';

type ProgressBarProps = {
  value: number;
  height?: number;
  label?: string;
};

export function ProgressBar({ value, height = 10, label }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const text = label ?? `${Math.round(clamped)}%`;

  return (
    <Tooltip
      content={`${value.toFixed(2)}%`}
      backgroundColor={colors.background['03']}
    >
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: '100%',
          background: colors.background['07'],
          borderRadius: 2,
          overflow: 'hidden',
          height,
          border: `1px solid ${colors.background['03']}`,
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background:
              'linear-gradient(90deg,rgba(42, 123, 155, 1) 0%, rgba(87, 199, 133, 1) 50%, rgba(237, 221, 83, 1) 100%)',
            transition: 'width 200ms ease',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.max(10, height * 0.7),
            color: 'white',
            whiteSpace: 'nowrap',
          }}
        >
          {height >= 18 ? text : null}
        </div>
      </div>
    </Tooltip>
  );
}
