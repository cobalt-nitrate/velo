import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        velo: {
          bg: '#080b14',
          panel: '#141a27',
          line: '#273146',
          accent: '#4fd1c5',
          text: '#eef2ff',
          muted: '#9aa7c7',
        },
      },
    },
  },
  plugins: [],
};

export default config;
