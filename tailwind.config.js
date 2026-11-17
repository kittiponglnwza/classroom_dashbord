/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F7FF',
          100: '#E0EFFF',
          200: '#B8DCFF',
          300: '#0071E3',
          400: '#0071E3',
          500: '#0071E3',
          600: '#0062C4',
          700: '#0051A3',
          800: '#003F80',
          900: '#002D5C',
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
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
