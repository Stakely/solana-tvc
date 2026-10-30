'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const isVisible = (): boolean => document.visibilityState === 'visible';
const onServer = (): boolean => true;

// False while the tab is hidden: polling pauses then (spec §6.2).
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, isVisible, onServer);
}
