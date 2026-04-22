'use client';

import { DataProvider } from '@/app/providers/data.tsx';
import { AnalyticsProvider } from '@/app/hooks';
import { ThemeProvider } from '@/app/components/theme/theme-provider.tsx';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      theme={{
        colors: {
          primary: {
            '01': '#fff',
            '02': '#5610ff',
            '03': '#36f5a3',
          },
          background: {
            '00': '#ffffff',
            '01': '#a1fffb',
            '02': '#15e0d4',
            '03': '#008888',
            '04': '#007a77',
            '05': '#003835',
            '06': '#003837',
            '07': '#002120',
          },
        },
      }}
    >
      <AnalyticsProvider>
        <DataProvider>{children}</DataProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
