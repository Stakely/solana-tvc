import { cleanup, screen, within } from '@testing-library/react';
import { Header } from '@/app/components/Header.tsx';
import { SITE_TITLE } from '@/app/components/measure-texts.ts';
import { renderUi, setViewportWidth } from '../support/fixtures.tsx';
import { hydrateAtWidth } from '../support/hydration.tsx';

// Title font size in rem (the theme sets sizes in rem).
function titleSize(root: HTMLElement = document.body): number {
  return parseFloat(within(root).getByText(SITE_TITLE).style.fontSize);
}

// Title size when the page is rendered in the browser at `width` px.
function sizeAtWidth(width: number): number {
  setViewportWidth(width);
  const view = renderUi(<Header />);
  const size = titleSize();
  view.unmount();
  return size;
}

describe('Header', () => {
  // Unmount before resizing: a resize with components mounted would update
  // them outside act().
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    setViewportWidth(1024);
  });

  it('links home and to How we measure, without reloading the page', () => {
    renderUi(<Header />);
    expect(
      screen.getByRole('link', { name: 'Solana Vote Inclusion Tracker' })
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('link', { name: 'How we measure' })
    ).toHaveAttribute('href', '/how-we-measure');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shrinks the title on a phone and keeps both links', () => {
    const desktopSize = sizeAtWidth(1024);

    setViewportWidth(375);
    renderUi(<Header />);
    expect(titleSize()).toBeLessThan(desktopSize);
    expect(
      screen.getByRole('link', { name: 'Solana Vote Inclusion Tracker' })
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('link', { name: 'How we measure' })
    ).toHaveAttribute('href', '/how-we-measure');
  });

  it('loads on a phone with the phone title, not the one in the server markup', () => {
    const desktopSize = sizeAtWidth(1024);
    const phoneSize = sizeAtWidth(375);
    expect(phoneSize).toBeLessThan(desktopSize);

    // The server always sends the desktop title. Hydrating it on a phone must
    // not leave that size in place: React does not patch mismatched styles.
    const { container, consoleError } = hydrateAtWidth(<Header />, 375);
    expect(titleSize(container)).toBe(phoneSize);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('loads on a wide screen with the desktop title', () => {
    const desktopSize = sizeAtWidth(1024);

    const { container, consoleError } = hydrateAtWidth(<Header />, 1280);
    expect(titleSize(container)).toBe(desktopSize);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
