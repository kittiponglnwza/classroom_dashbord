/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7ff',
          100: '#e1eeff',
          200: '#bcdbff',
          300: '#84beff',
          400: '#4597ff',
          505: '#1a73e8', // Google Classroom Blue
          500: '#1a73e8',
          600: '#0b57d0',
          700: '#0845a7',
          800: '#0b3985',
          900: '#0f3069',
        },
        dark: {
          bg: '#0F0F11',       // Deep body bg
          sidebar: '#18181C',  // Clean sidebar bg (Notion style)
          card: '#1F1F24',     // Elegant card bg
          border: '#2E2E35',   // Subtle borders
          hover: '#2A2A30',    // Hover states
          text: '#F3F4F6',     // Bright text
          muted: '#9CA3AF'     // Dimmed text
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
