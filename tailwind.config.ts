import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        qp: {
          primary: '#059669',
          'primary-dark': '#047857',
          'primary-light': '#ecfdf5',
          sidebar: '#022c22',
          'sidebar-hover': '#064e3b',
          'sidebar-active': '#065f46',
          'sidebar-text': '#a7f3d0',
          'sidebar-muted': '#6ee7b7',
          surface: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          accent: '#0d9488',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
