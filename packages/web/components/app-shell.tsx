'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Overview', icon: '◆' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/files', label: 'Files', icon: '📁' },
  { href: '/uploads', label: 'Uploads', icon: '⬆' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith('/auth');

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-52 shrink-0 flex-col border-r border-velo-line bg-velo-panel/90">
        <div className="border-b border-velo-line px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-velo-accent">
            Velo
          </Link>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-velo-muted">
            Command Center
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-velo-accent/15 text-velo-text'
                    : 'text-velo-muted hover:bg-white/5 hover:text-velo-text'
                }`}
              >
                <span className="mr-2 opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
