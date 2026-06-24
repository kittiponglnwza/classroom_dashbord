/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Support class-based theme toggling
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7ff',
          100: '#e1eeff',
          200: '#bcdbff',
          300: '#84beff',
          400: '#4597ff',
          500: '#1a73e8',
          600: '#0b57d0',
          700: '#0845a7',
          800: '#0b3985',
          900: '#0f3069',
        },
        dark: {
          bg: 'var(--bg)',
          sidebar: 'var(--sidebar)',
          card: 'var(--card)',
          border: 'var(--border)',
          hover: 'var(--hover)',
          text: 'var(--text)',
          muted: 'var(--muted)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
