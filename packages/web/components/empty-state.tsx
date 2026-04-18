'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

export interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  body: string;
  actions?: EmptyStateAction[];
}

const DEFAULT_ICON = (
  <svg
    className="h-10 w-10 text-velo-muted/50"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.25}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export function EmptyState({ icon, heading, body, actions }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={heading}
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-velo-line bg-velo-panel/40 p-12 text-center"
    >
      <div className="flex items-center justify-center">{icon ?? DEFAULT_ICON}</div>
      <div className="max-w-xs space-y-1">
        <p className="text-sm font-semibold text-velo-text">{heading}</p>
        <p className="text-xs text-velo-muted">{body}</p>
      </div>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {actions.map((a) =>
            a.href ? (
              <Link
                key={a.label}
                href={a.href}
                className={
                  a.primary
                    ? 'rounded-lg bg-velo-accent px-4 py-2 text-xs font-semibold text-white hover:bg-velo-accent-hover'
                    : 'rounded-lg border border-velo-line bg-velo-inset px-4 py-2 text-xs font-medium text-velo-text hover:border-velo-accent/40'
                }
              >
                {a.label}
              </Link>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className={
                  a.primary
                    ? 'rounded-lg bg-velo-accent px-4 py-2 text-xs font-semibold text-white hover:bg-velo-accent-hover'
                    : 'rounded-lg border border-velo-line bg-velo-inset px-4 py-2 text-xs font-medium text-velo-text hover:border-velo-accent/40'
                }
              >
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
