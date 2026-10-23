import {
  Children,
  createElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import RootLayout, { metadata } from '@/app/layout.tsx';
import { Footer, Header } from '@/app/components';
import { FOOTER_HEIGHT } from '@/app/components/footer-height.ts';

describe('layout metadata', () => {
  it('names the site after vote inclusion', () => {
    expect(metadata.title).toBe('Solana Vote Inclusion Tracker - By Stakely');
    expect(metadata.applicationName).toBe('Solana Vote Inclusion Tracker');
    expect(metadata.description).toBe(
      'Live vote inclusion rate (VIR) and epoch ratio of Solana validators under Alpenglow.'
    );
    expect(metadata.keywords).toContain('vote inclusion');
  });
});

type Props = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};
type El = ReactElement<Props>;

// First element, depth first, that `match` accepts. Components such as Header
// are not expanded, so only the markup that layout.tsx itself writes is seen.
function find(node: ReactNode, match: (el: El) => boolean): El | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Props>(child)) continue;
    if (match(child)) return child;
    const inner = find(child.props.children, match);
    if (inner) return inner;
  }
  return undefined;
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`layout.tsx has no ${what}`);
  return value;
}

describe('layout shell', () => {
  const tree = RootLayout({ children: createElement('p', null, 'page') });
  const shell = required(
    find(tree, (el) => el.props.className?.includes('flex-col') ?? false),
    'flex column shell'
  );
  const [header, scroller, footer] = Children.toArray(
    shell.props.children
  ) as El[];

  // The header grows when its link wraps to a second row on a phone, and the
  // footer is fixed to the bottom of the viewport, so the content area cannot
  // be sized with a hard-coded header height: it takes what is left.
  it('stacks the header, the scrolling content and the fixed footer in a full-height column', () => {
    expect(shell.props.style).toMatchObject({
      height: '100vh',
      paddingBottom: FOOTER_HEIGHT,
    });
    expect(header.type).toBe(Header);
    expect(footer.props.className).toContain('fixed');
    expect(find(footer, (el) => el.type === Footer)).toBeDefined();
  });

  it('lets the content fill the space the header and footer leave and scroll inside it', () => {
    expect(scroller.props.style).toMatchObject({
      flex: '1 1 0%',
      minHeight: 0,
      overflowY: 'auto',
    });
    expect(scroller.props.style).not.toHaveProperty('maxHeight');
    expect(find(scroller, (el) => el.type === 'main')).toBeDefined();
    expect(find(scroller, (el) => el.type === 'p')).toBeDefined();
  });
});
