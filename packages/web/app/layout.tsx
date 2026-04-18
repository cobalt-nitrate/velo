import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ensureConnectorEnvLoaded } from '@/lib/server-bootstrap';
import { AppShell } from '../components/app-shell';
import { VeloSessionProvider } from '../components/session-provider';

export const metadata: Metadata = {
  title: 'Velo Command Center',
  description: 'Policy-first autonomous back-office command center.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  ensureConnectorEnvLoaded();
  return (
    <html lang="en">
      <body>
        <VeloSessionProvider>
          <AppShell>{children}</AppShell>
        </VeloSessionProvider>
      </body>
    </html>
  );
}
