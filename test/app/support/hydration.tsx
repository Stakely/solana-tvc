import { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/app/components/theme/theme-provider.tsx';
import { AnalyticsProvider } from '@/app/hooks/analytics.tsx';
import { setViewportWidth } from './fixtures.tsx';

// jsdom resolves react-dom/server to its browser build, which needs TextEncoder
// at load time and jsdom has none. The node build does not.
type ServerModule = typeof import('react-dom/server');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToString }: ServerModule = require('react-dom/server.node');

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AnalyticsProvider>{children}</AnalyticsProvider>
    </ThemeProvider>
  );
}

// Loads the page the way a phone does: the server markup is rendered first,
// then hydrated on a viewport of `width` px. The server has no window, so any
// code that reads the viewport sees the desktop case there; jsdom does have
// one, so it is set to 1024 px for that step. React logs what did not match
// the server markup through console.error, so that spy is returned (the caller
// restores it with jest.restoreAllMocks). RTL unmounts the container.
export function hydrateAtWidth(
  ui: ReactNode,
  width: number
): { container: HTMLElement; consoleError: jest.SpyInstance } {
  setViewportWidth(1024);
  const serverHtml = renderToString(<Providers>{ui}</Providers>);

  setViewportWidth(width);
  const container = document.createElement('div');
  container.innerHTML = serverHtml;
  document.body.appendChild(container);

  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  render(ui, { container, hydrate: true, wrapper: Providers });
  return { container, consoleError };
}
