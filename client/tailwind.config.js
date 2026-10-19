/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware neutrals (flip automatically in dark mode via CSS variables).
        surface: {
          DEFAULT: token('surface'),
          raised: token('surface-raised'),
          muted: token('surface-muted')
        },
        sand: {
          50: token('sand-50'),
          100: token('sand-100'),
          200: token('sand-200'),
          300: token('sand-300')
        },
        ink: {
          DEFAULT: token('ink'),
          soft: token('ink-soft'),
          muted: token('ink-muted')
        },
        // Theme-aware brand tints: soft backgrounds/borders in light mode,
        // readable brand text and deep tints in dark mode (see index.css).
        brand: {
          50: token('brand-50'),
          100: token('brand-100'),
          200: token('brand-200'),
          300: token('brand-300'),
          400: token('brand-400'),
          500: token('brand-500'),
          600: token('brand-600'),
          700: token('brand-700'),
          800: token('brand-800'),
          900: token('brand-900'),
          950: token('brand-950')
        },
        // Fixed Navy Blue primary (#0B1F4B) for solid fills, logo and dark bands.
        navy: {
          50: '#edf3ff',
          100: '#dbe7fe',
          200: '#bfd3fc',
          300: '#93b4f8',
          400: '#6090f2',
          500: '#3b6fe8',
          600: '#2454c4',
          700: '#1b3f9b',
          800: '#16337a',
          900: '#0b1f4b',
          950: '#071433'
        },
        // Electric Purple accent (#7C3AED).
        accent: {
          50: '#f3eeff',
          100: '#e7ddff',
          200: '#cdbbfe',
          300: '#b197fb',
          400: '#9a73f7',
          500: '#7c3aed',
          600: '#6a28d6',
          700: '#591fb0',
          800: '#47198a',
          900: '#360f63',
          950: '#22083e'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        bangla: ['"Noto Sans Bengali"', 'Inter', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'Inter', 'serif']
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11, 31, 75, 0.04), 0 10px 30px -12px rgba(11, 31, 75, 0.16)',
        float: '0 24px 60px -24px rgba(11, 31, 75, 0.4)',
        card: '0 2px 4px rgba(11, 31, 75, 0.03), 0 18px 38px -24px rgba(11, 31, 75, 0.22)'
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
