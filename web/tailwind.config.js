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
          700: '#1E232F',
          600: '#2A303F',
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
          neon: '#FF2A85',
        }
      },
      boxShadow: {
        'pink-glow': '0 0 25px -5px rgba(255, 42, 133, 0.35)',
        'pink-sm': '0 0 12px rgba(236, 72, 153, 0.25)',
      }
    },
  },
  plugins: [],
}

