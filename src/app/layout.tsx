import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/app/providers/providers.tsx';
import { Footer, Header } from '@/app/components';

export const metadata: Metadata = {
  title: 'Solana TVC Live view - By Stakely',
  description: 'Track your validator performance',
  applicationName: 'Solana Live TVC',
  keywords: [
    'Solana',
    'validator',
    'staking',
    'performance',
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

            <div className="min-h-screen flex flex-col items-center content-center">
              <Header />
              <div
                className="w-full flex content-center"
                style={{
                  maxHeight: 'calc(100vh - 130px)',
                  overflowY: 'auto',
                }}
              >
                <main
                  className="flex-1 w-full p-x-30"
                  style={{
                    maxWidth: '1280px',
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
