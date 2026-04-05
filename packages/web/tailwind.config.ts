import type { Config } from 'tailwindcss';

/**
 * Enterprise light UI: bright surfaces, high-contrast type, restrained teal accent.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        velo: {
          bg: '#f6f8fc',
          panel: '#ffffff',
          'panel-muted': '#f3f6fb',
          line: '#d7dee9',
          inset: '#eef2f9',
          'inset-deep': '#e4eaf4',
          accent: '#0f766e',
          'accent-hover': '#0d5c56',
          text: '#0b1220',
          muted: '#4a5568',
        },
      },
      boxShadow: {
        shell: '4px 0 28px -10px rgba(15, 23, 42, 0.07)',
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -16px rgba(15, 23, 42, 0.1)',
        soft: '0 1px 3px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
