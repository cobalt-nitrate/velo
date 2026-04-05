import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { VeloSessionProvider } from '../components/session-provider';

export const metadata: Metadata = {
  title: 'Velo Command Center',
  description: 'Policy-first autonomous back-office command center.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <VeloSessionProvider>{children}</VeloSessionProvider>
      </body>
    </html>
  );
}
