/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#060709',
          900: '#0B0E14',
          850: '#10141D',
          800: '#151922',
          750: '#1A1F2B',
          700: '#1E232F',
          600: '#2A303F',
          500: '#363D4F',
        },
        brand: {
          50: '#FDF2F8',
          100: '#FCE7F3',
          200: '#FBCFE8',
          300: '#F9A8D4',
          400: '#F472B6',
          500: '#EC4899',
          600: '#DB2777',
          700: '#BE185D',
          800: '#9D174D',
          neon: '#FF2A85',
        }
      },
      boxShadow: {
        'pink-glow': '0 0 30px -5px rgba(255, 42, 133, 0.3)',
        'pink-sm': '0 0 15px rgba(236, 72, 153, 0.2)',
        'pink-lg': '0 8px 40px -8px rgba(236, 72, 153, 0.25)',
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(236, 72, 153, 0.1)',
        'dropdown': '0 16px 48px -8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(30, 35, 47, 0.8)',
        'modal': '0 24px 64px -16px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(236, 72, 153, 0.15)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-down': 'slideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-card': 'linear-gradient(135deg, rgba(21, 25, 34, 1) 0%, rgba(16, 20, 29, 1) 100%)',
      },
    },
  },
  plugins: [],
}
