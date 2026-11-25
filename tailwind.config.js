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
          50: '#172540',
          100: '#1E3A8A',
          200: '#1D4ED8',
          300: '#60A5FA',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
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
        sans: ['IBM Plex Sans', 'IBM Plex Sans Thai', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['IBM Plex Sans', 'IBM Plex Sans Thai', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
