/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f4',
          100: '#d5ece4',
          500: '#0f766e',
          600: '#0d655e',
          700: '#0b544e',
        },
      },
    },
  },
  plugins: [],
};
