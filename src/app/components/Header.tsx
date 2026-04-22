'use client';

import { FC, useRef } from 'react';
import { Text } from '@/app/components/ui';

export const Header: FC = () => {
  const isAnimatingRef = useRef(false);

  const playAndGoHome = () => {
    if (isAnimatingRef.current) return;

    const logo = document.querySelector<HTMLImageElement>('[data-logo]');
    if (!logo) {
      window.location.reload();
      return;
    }

    isAnimatingRef.current = true;

    logo.classList.remove('logo-clicked');
    logo.classList.add('logo-clicked');

    window.setTimeout(() => {
      window.location.reload();
      window.setTimeout(() => {
        isAnimatingRef.current = false;
      }, 200);
    }, 260);
  };

  return (
    <div
      className={
        'w-full flex items-center gap-15 p-x-30 cursor-pointer header-clickable'
      }
      style={{ height: '80px' }}
      onClick={playAndGoHome}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') playAndGoHome();
      }}
    >
      <span className="logo-wrap">
        <img
          data-logo
          className="logo-img"
          alt={'Solana'}
          src={'./solana_icon.png'}
          width={35}
          height={35}
          draggable={false}
        />
        <span className="logo-glow" aria-hidden="true" />
      </span>

      <Text variant={'h2'} content={'TVC Live Tracker'} />
    </div>
  );
};
