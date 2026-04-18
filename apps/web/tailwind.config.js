/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5f3ff',
          500: '#7C3AED',
          600: '#6D28D9',
          900: '#2e1065'
        }
      }
    }
  },
  plugins: []
}
