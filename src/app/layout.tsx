import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/app/providers/providers.tsx';
import { Footer, Header } from '@/app/components';
import { FOOTER_HEIGHT } from '@/app/components/footer-height.ts';
import { SITE_TITLE } from '@/app/components/measure-texts.ts';

export const metadata: Metadata = {
  title: `${SITE_TITLE} - By Stakely`,
  description:
    'Live vote inclusion rate (VIR) and epoch ratio of Solana validators under Alpenglow.',
  applicationName: SITE_TITLE,
  keywords: [
    'Solana',
    'validator',
    'staking',
    'performance',
    'vote inclusion',
    'VIR',
    'epoch ratio',
    'Alpenglow',
    'TVC',
    'Stakely',
    'Solana validators',
  ],
  authors: [{ name: 'Stakely' }],
  creator: 'Stakely',
  publisher: 'Stakely',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className={'w-full h-100vh relative'}>
          <Providers>
            <div className="grid-floor" aria-hidden="true" />

            <div
              className="flex flex-col items-center content-center"
              style={{ height: '100vh', paddingBottom: FOOTER_HEIGHT }}
            >
              <Header />
              <div
                className="w-full flex content-center"
                style={{
                  flex: '1 1 0%',
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                <main
                  className="flex-1 w-full p-x-30"
                  style={{
                    maxWidth: '1410px',
                  }}
                >
                  {children}
                </main>
              </div>

              <div className={'w-full fixed b-0'}>
                <Footer />
              </div>
            </div>
          </Providers>
        </div>
      </body>
    </html>
  );
}
