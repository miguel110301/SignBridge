/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Montserrat', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f4f7fb',
          100: '#e7f0f6',
          200: '#cdddeb',
          300: '#a3c2db',
          400: '#719fc6',
          500: '#4c81ae',
          600: '#386591',
          700: '#2d5177',
          800: '#274563',
          900: '#233a53',
          950: '#113658', // Deep Ocean Blue
        },
        accent: {
          50:  '#f0fbfa',
          100: '#d7f4f4',
          200: '#b3eaeb',
          300: '#7edade',
          400: '#42c0c7',
          500: '#39c2d7', // Turquoise Wave
          600: '#1f8590',
          700: '#1d6a74',
          800: '#1d555e',
          900: '#1b474e',
          950: '#0e2d33',
        },
        tertiary: {
          50:  '#fbf8f3',
          100: '#f5eee2',
          200: '#eaddc1',
          300: '#dcc197',
          400: '#cda168',
          500: '#c9a26a', // Sand Gold
          600: '#b47336',
          700: '#965a2d',
          800: '#7a4a29',
          900: '#623c24',
          950: '#351f11',
        },
      },
    },
  },
  plugins: [],
}
