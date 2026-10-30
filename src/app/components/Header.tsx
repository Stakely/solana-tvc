'use client';

import { FC } from 'react';
import Link from 'next/link';
import { Text } from '@/app/components/ui';
import { useIsMobile } from '@/app/hooks';
import {
  HOW_WE_MEASURE_TITLE,
  SITE_TITLE,
} from '@/app/components/measure-texts.ts';

// On a phone (375 px) the title is body1 bold and the link wraps to a second
// row, so the header grows instead of squeezing the title into three lines.
export const Header: FC = () => {
  const isMobile = useIsMobile();
  return (
    <header
      className={
        'w-full flex flex-wrap items-center space-between gap-15 p-x-30 p-y-10'
      }
      style={{ minHeight: '80px', boxSizing: 'border-box' }}
    >
      <Link href={'/'} className={'flex items-center gap-15 header-clickable'}>
        <span className="logo-wrap">
          <img
            data-logo
            className="logo-img"
            alt={''}
            src={'/solana_icon.png'}
            width={35}
            height={35}
            draggable={false}
          />
          <span className="logo-glow" aria-hidden="true" />
        </span>
        {isMobile ? (
          <Text weight={700} content={SITE_TITLE} />
        ) : (
          <Text variant={'h2'} content={SITE_TITLE} />
        )}
      </Link>
      <Link href={'/how-we-measure'}>
        <Text weight={700} underline content={HOW_WE_MEASURE_TITLE} />
      </Link>
    </header>
  );
};
