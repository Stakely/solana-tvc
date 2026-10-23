import { act, renderHook } from '@testing-library/react';
import { usePageVisible } from '@/app/hooks/page-visible.tsx';
import { setVisibility } from '../support/fixtures.tsx';

describe('usePageVisible', () => {
  beforeEach(() => setVisibility('visible'));
  afterEach(() => setVisibility('visible'));

  it('follows document.visibilityState', () => {
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(true);
    act(() => setVisibility('hidden'));
    expect(result.current).toBe(false);
    act(() => setVisibility('visible'));
    expect(result.current).toBe(true);
  });
});
