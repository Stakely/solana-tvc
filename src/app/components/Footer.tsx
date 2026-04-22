'use client';

import { FC } from 'react';
import { StakelyLogo } from '@/app/components/StakelyLogo.tsx';
import { Text } from '@/app/components/ui';

export const Footer: FC = () => {
  return (
    <footer
      className={
        'w-full items-center content-center flex gap-20 bg-translucent'
      }
      style={{
        height: '50px',
      }}
    >
      <Text
        content={
          'Built by <l:https://stakely.io>Stakely</l> - <l: https://stakely.io/staking/solana-staking>Stake SOL with us</l>'
        }
      />
      <StakelyLogo />
    </footer>
  );
};
