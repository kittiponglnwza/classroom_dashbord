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
          50: '#094771',
          100: '#0E639C',
          200: '#1177BB',
          300: '#3794FF',
          400: '#3794FF',
          500: '#007ACC',
          600: '#1177BB',
          700: '#0E639C',
          800: '#094771',
          900: '#062F4A',
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
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
