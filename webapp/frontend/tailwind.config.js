/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './admin.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        gaming: ['"Chakra Petch"', 'Montserrat', 'sans-serif'],
      },
      colors: {
        bg: '#070a0f',
        card: '#0e1422',
        cardHover: '#131c30',
        accent: '#3b82f6',
        accentPurple: '#8b5cf6',
        accentEmerald: '#10b981',
        accent2: '#8b5cf6',
      },
    },
  },
  plugins: [],
}
