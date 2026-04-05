'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';

const LS_KEY = 'velo-sidebar-collapsed';

function IconOverview({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="9" rx="1.25" />
      <rect x="14" y="3" width="7" height="5" rx="1.25" />
      <rect x="14" y="12" width="7" height="9" rx="1.25" />
      <rect x="3" y="16" width="7" height="5" rx="1.25" />
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5H7l-4 3v-3A8.5 8.5 0 013 11.5a8.5 8.5 0 018.5-8.5h.2a8.5 8.5 0 019.3 8.5z" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
    </svg>
  );
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

function IconTable({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h16M4 12h10M4 18h16M14 9h6M14 15h6" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const NAV = [
  { href: '/', label: 'Overview', Icon: IconOverview },
  { href: '/chat', label: 'Chat', Icon: IconChat },
  { href: '/operations', label: 'Operations', Icon: IconTable },
  { href: '/files', label: 'Files', Icon: IconFolder },
  { href: '/uploads', label: 'Uploads', Icon: IconUpload },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
] as const;

const ICON_CLASS = 'h-[1.15rem] w-[1.15rem]';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith('/auth');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(LS_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const persistCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(LS_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`relative z-30 flex shrink-0 flex-col border-r border-velo-line bg-velo-panel shadow-shell transition-[width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] ${
          collapsed ? 'w-[4.25rem]' : 'w-56'
        }`}
      >
        <div
          className={`relative z-10 border-b border-velo-line ${
            collapsed ? 'px-2 py-3' : 'px-4 py-4 pr-2'
          }`}
        >
          <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between gap-1'}`}>
            <Link
              href="/"
              className={`group flex min-w-0 items-center gap-2 rounded-lg transition-opacity hover:opacity-95 ${
                collapsed ? 'justify-center' : ''
              }`}
              title="Velo home"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-velo-accent/10 ring-1 ring-velo-accent/25">
                <span className="text-sm font-bold tracking-tight text-velo-accent">V</span>
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold tracking-tight text-velo-text">Velo</div>
                  <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-velo-muted">
                    Command Center
                  </p>
                </div>
              )}
            </Link>
            {collapsed ? (
              <button
                type="button"
                onClick={() => persistCollapsed(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-velo-muted transition-colors hover:bg-velo-inset hover:text-velo-accent"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => persistCollapsed(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-velo-muted transition-colors hover:bg-velo-inset hover:text-velo-accent"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Main">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                } ${
                  active
                    ? 'bg-velo-accent/10 text-velo-text shadow-[inset_3px_0_0_0_#0f766e]'
                    : 'text-velo-muted hover:bg-velo-inset hover:text-velo-text'
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
                    active ? 'text-velo-accent' : 'text-velo-muted group-hover:text-velo-accent/90'
                  }`}
                >
                  <Icon className={ICON_CLASS} />
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center opacity-40">
            <div className="h-1 w-10 rounded-full bg-velo-line" />
          </div>
        )}
      </aside>
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
