/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f3eeff',
          100: '#e9deff',
          200: '#d4bdff',
          300: '#b896ff',
          400: '#9d6ff5',
          500: '#7c4de8',
          600: '#6830d0',
          700: '#5522b0',
          800: '#3D1A6E',
          900: '#2D1057',
        },
        accent: {
          50:  '#fff4ee',
          100: '#ffe8d9',
          400: '#ff8c5a',
          500: '#FF6B35',
          600: '#e85520',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
