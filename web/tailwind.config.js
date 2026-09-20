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
          900: '#0B0E14',
          800: '#151921',
          700: '#1E232F',
          600: '#2A303F',
        },
        brand: {
          500: '#5865F2',
          600: '#4752C4',
        }
      }
    },
  },
  plugins: [],
}
