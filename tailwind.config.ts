import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#e67e22',
        'brand-dark': '#944a00',
        admin: '#2563eb',
      },
    },
  },
  plugins: [],
};

export default config;
