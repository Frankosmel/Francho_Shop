/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1419',
        card: '#1a2332',
        accent: '#3b82f6',
        accent2: '#8b5cf6',
      },
    },
  },
  plugins: [],
}
