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
          primary: '#2563eb',
          'primary-dark': '#1d4ed8',
          'primary-light': '#eff6ff',
          sidebar: '#0f172a',
          'sidebar-hover': '#1e293b',
          'sidebar-active': '#1e40af',
          'sidebar-text': '#bfdbfe',
          'sidebar-muted': '#93c5fd',
          surface: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          accent: '#3b82f6',
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
