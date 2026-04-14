/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light
        primary:              '#1A1C21',
        accent:               '#00C853',
        'accent-dim':         '#E8F5E9',
        surface:              '#F8FAFC',
        'on-surface':         '#1A1C21',
        'on-surface-variant': '#64748B',
        'outline-variant':    '#E2E8F0',
        // Dark
        'dark-bg':            '#0F1117',
        'dark-surface':       '#1A1D23',
        'dark-surface-2':     '#21252D',
        'dark-border':        '#2A2E38',
        'dark-text':          '#E2E8F0',
        'dark-text-muted':    '#94A3B8',
        'dark-text-faint':    '#475569',
        'dark-accent':        '#00E676',
        'dark-accent-dim':    '#0D2B1A',
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
        manrope: ['Manrope'],
      },
    },
  },
  plugins: [],
};
