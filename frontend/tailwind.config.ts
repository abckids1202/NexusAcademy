import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          ink: '#14213d',
          teal: '#1b998b',
          coral: '#ef476f',
          gold: '#f7b801',
          mist: '#f4f7fb'
        }
      }
    }
  },
  plugins: []
} satisfies Config;

