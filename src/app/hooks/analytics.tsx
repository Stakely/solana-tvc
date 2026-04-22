'use client';

import { createContext, ReactNode, useContext, useEffect } from 'react';

/**
 * Analytics context contract.
 * Exposes a single method to track events with string-based properties.
 */
type AnalyticsContextType = {
  /**
   * Sends an analytics event with a set of key/value string properties.
   *
   * If analytics is disabled or Umami is not available on `window`, this is a no-op.
   *
   * @param event Event name (e.g. "solana_native_stake_complete").
   * @param data Event properties as a string map.
   */
  sendEvent: (event: string, data: Record<string, string>) => void;
};

/**
 * React context holding analytics helpers.
 * It is initialized with `null` and must be provided by `AnalyticsProvider`.
 */
const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

/**
 * Window typing for Umami.
 * Umami is injected at runtime and exposed as `window.umami`.
 */
type UmamiWindow = Window & {
  umami:
    | {
        track: (str: string, args: Record<string, string>) => void;
      }
    | undefined;
};

/**
 * Provides analytics capabilities through React context.
 *
 * - Reads `UMAMI_PROJECT_ID` from settings.
 * - If `UMAMI_PROJECT_ID !== 'false'`, analytics is enabled and the Umami script is injected.
 * - Exposes `sendEvent()` which calls `window.umami.track(...)` when available.
 *
 * Notes:
 * - Script is injected once on mount.
 * - If the script has not loaded yet, events are silently ignored (no-op).
 */
export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  /**
   * Injects Umami's tracking script into the document `<head>`.
   *
   * The project id is passed via `data-website-id`.
   * A custom host endpoint is set via `data-host-url`.
   */
  const _injectUmamiScript = () => {
    const projectId = 'edb7f2e6-8bc0-44a6-a016-3f69470d3288';
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://umami.stakely.io/stats';
    script.setAttribute('data-website-id', projectId);
    document.head.appendChild(script);
  };

  /**
   * Injects Umami on initial mount if analytics is enabled.
   */
  useEffect(() => {
    _injectUmamiScript();
    // Intentionally only runs on mount.
    // If `enabled` changes at runtime, the script is not re-injected.
  }, []);

  /**
   * Tracks an analytics event via Umami.
   *
   * This method is safe to call at any time:
   * - If analytics is disabled, it returns early.
   * - If Umami hasn't loaded yet (`window.umami` is undefined), it returns early.
   *
   * @param event Event name.
   * @param data Event properties.
   */
  const sendEvent = (event: string, data: Record<string, string>) => {
    const umami = (window as unknown as UmamiWindow).umami;
    if (!umami) {
      return;
    }

    umami.track(event, data);
  };

  return (
    <AnalyticsContext.Provider
      value={{
        sendEvent,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};

/**
 * Hook to access analytics methods from `AnalyticsContext`.
 *
 * Must be used within an `AnalyticsProvider`, otherwise it throws.
 *
 * @returns The analytics context value containing `sendEvent`.
 * @throws If used outside of `AnalyticsProvider`.
 */
export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics() must be used within AnalyticsProvider');
  }

  return context;
};
