import { act, cleanup, renderHook } from '@testing-library/react';
import { useIsMobile } from '@/app/hooks/is-mobile.tsx';
import { setViewportWidth } from '../support/fixtures.tsx';
import { hydrateAtWidth } from '../support/hydration.tsx';

function Probe() {
  const isMobile = useIsMobile();
  return <p data-mobile={String(isMobile)}>probe</p>;
}

describe('useIsMobile', () => {
  // Unmount before resizing: a resize with components mounted would update
  // them outside act().
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    setViewportWidth(1024);
  });

  it('follows the viewport width, with 768 px as the default breakpoint', () => {
    setViewportWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => setViewportWidth(767));
    expect(result.current).toBe(true);
    act(() => setViewportWidth(768));
    expect(result.current).toBe(false);
  });

  it('takes the breakpoint as a parameter', () => {
    setViewportWidth(600);
    const { result } = renderHook(() => useIsMobile(500));
    expect(result.current).toBe(false);
    act(() => setViewportWidth(400));
    expect(result.current).toBe(true);
  });

  it('hydrates on a phone from the server value, then switches to the real width', () => {
    const { container, consoleError } = hydrateAtWidth(<Probe />, 375);
    // The server markup said desktop; React does not patch attributes that
    // differ, so the phone value has to arrive in a second render.
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector('p')).toHaveAttribute(
      'data-mobile',
      'true'
    );
  });

  it('keeps the desktop value when hydrating on a wide screen', () => {
    const { container, consoleError } = hydrateAtWidth(<Probe />, 1280);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector('p')).toHaveAttribute(
      'data-mobile',
      'false'
    );
  });
});
