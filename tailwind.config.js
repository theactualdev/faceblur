/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7dccfd',
          400: '#36b3f9',
          500: '#0d99f0',
          600: '#0177cd',
          700: '#0261a7',
          800: '#065389',
          900: '#0b4672',
          950: '#072c4a',
        },
        secondary: {
          50: '#f5f7ff',
          100: '#eef1ff',
          200: '#dde3ff',
          300: '#c2cbff',
          400: '#a1a9ff',
          500: '#7f85fa',
          600: '#6660ef',
          700: '#5349d6',
          800: '#463dab',
          900: '#3b3789',
          950: '#232154',
        },
        accent: {
          50: '#fef2ff',
          100: '#fee5ff',
          200: '#fdcbff',
          300: '#fca2ff',
          400: '#fa69ff',
          500: '#f139fa',
          600: '#d816d9',
          700: '#b80db3',
          800: '#950f92',
          900: '#7a1178',
          950: '#500052',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};