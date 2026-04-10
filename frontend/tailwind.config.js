/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1A1C21',
        accent: '#00C853',
        'accent-dim': '#E8F5E9',
        surface: '#F8FAFC',
        'on-surface': '#1A1C21',
        'on-surface-variant': '#64748B',
        'outline-variant': '#E2E8F0',
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        full: '9999px',
      },
      fontFamily: {
        headline: ['Manrope'],
        body: ['Manrope'],
        label: ['Manrope'],
      },
    },
  },
  plugins: [],
};
