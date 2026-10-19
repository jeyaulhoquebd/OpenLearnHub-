/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edfcf6',
          100: '#d4f7e9',
          200: '#abeed7',
          300: '#74dfc0',
          400: '#3cc8a4',
          500: '#1aab8a',
          600: '#0d8a70',
          700: '#0c6e5b',
          800: '#0d574a',
          900: '#0c493f',
          950: '#032923'
        },
        ink: {
          DEFAULT: '#12221e',
          soft: '#334640',
          muted: '#5e716b'
        },
        sand: {
          50: '#fbfaf6',
          100: '#f5f2e9',
          200: '#ebe4d2',
          300: '#ded2b7'
        },
        coral: {
          400: '#f08a6b',
          500: '#e56d4c',
          600: '#cb5234',
          700: '#a8402a'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        bangla: ['"Noto Sans Bengali"', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif']
      },
      boxShadow: {
        soft: '0 1px 2px rgba(18, 34, 30, 0.04), 0 10px 30px -12px rgba(18, 34, 30, 0.16)',
        float: '0 24px 60px -24px rgba(12, 73, 63, 0.38)',
        card: '0 2px 4px rgba(18, 34, 30, 0.03), 0 18px 38px -24px rgba(18, 34, 30, 0.22)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 4s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
