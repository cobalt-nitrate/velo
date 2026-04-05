'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function baseProps(size: number): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  };
}

export function IconPaperclip({ size = 18, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSearch({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path d="M20 20l-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconPencil({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTarget({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconUsers({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTable({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18M10 4v16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconInfo({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlay({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path
        d="M8 5v14l11-7L8 5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevronRight({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronLeft({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSparkle({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path
        d="M12 3l1.09 3.36h3.53l-2.86 2.08 1.1 3.36L12 10.77 8.14 11.8l1.1-3.36L6.38 6.36h3.53L12 3zM19 15l.6 1.86h1.96l-1.59 1.15.61 1.86L19 18.86l-1.59 1.15.61-1.86-1.59-1.15h1.96L19 15zM5 18l.5 1.5h1.55l-1.25.9.48 1.5L5 20.9l-1.28.93.48-1.5-1.25-.9h1.55L5 18z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDatabase({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconLink({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className} {...rest}>
      <path
        d="M10 13a5 5 0 007.54.54l2.12-2.12a5 5 0 00-7.07-7.07L11.44 7M14 11a5 5 0 00-7.54-.54L4.34 12.62a5 5 0 007.07 7.07L13 17.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLoader({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      {...baseProps(size)}
      className={`animate-spin ${className ?? ''}`.trim()}
      {...rest}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" opacity="0.25" />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
