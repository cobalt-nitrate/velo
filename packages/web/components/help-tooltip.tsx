'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface HelpTooltipProps {
  text: string;
  /** Preferred side: 'top' | 'right' | 'bottom' | 'left' (default: 'top') */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Accessible help tooltip.
 * - Renders as a `?` button with aria-describedby pointing to the tooltip text.
 * - Shows on hover AND keyboard focus; dismisses on Escape.
 * - Tooltip element has role="tooltip" and id matching the trigger's aria-describedby.
 */
export function HelpTooltip({ text, side = 'top' }: HelpTooltipProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  // Dismiss on Escape key
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setVisible(false);
        ref.current?.blur();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  const positionClass: Record<string, string> = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  };

  return (
    <span className="relative inline-flex">
      <button
        ref={ref}
        type="button"
        aria-describedby={visible ? id : undefined}
        aria-label="Help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-velo-line bg-velo-inset text-[10px] font-bold text-velo-muted hover:border-velo-accent/50 hover:text-velo-accent focus:outline-none focus:ring-2 focus:ring-velo-accent/40"
      >
        ?
      </button>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-56 rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-xs text-velo-text shadow-md ${positionClass[side] ?? positionClass.top}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
