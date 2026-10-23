'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

// The server has no window and always renders the desktop layout. Hydrating
// has to start from that same value: React does not patch attributes that
// differ from the server markup, so a phone that started from its real width
// would keep the desktop styles. Right after hydrating, a phone renders again
// with its real width.
const onServer = (): boolean => false;

export function useIsMobile(breakpoint: number = 768): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth < breakpoint,
    onServer
  );
}
