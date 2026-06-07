import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#000000',
        'brand-dark': '#000000',
        admin: '#2563eb',
      },
    },
  },
  plugins: [],
};

export default config;
