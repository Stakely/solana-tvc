// Height of the footer, which is fixed to the bottom of the viewport. The page
// shell in layout.tsx reserves this room under the scrolling content. No
// 'use client': layout.tsx is a server component and Footer.tsx a client one,
// and both import it.
export const FOOTER_HEIGHT = '50px';
