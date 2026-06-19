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
          slate: {
            950: '#030712',
            900: '#0f172a',
            800: '#1e293b',
            700: '#334155',
            600: '#475569'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif']
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s infinite alternate'
      },
      keyframes: {
        'glow-pulse': {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.2), 0 0 10px rgba(59, 130, 246, 0.1)' },
          '100%': { boxShadow: '0 0 15px rgba(59, 130, 246, 0.4), 0 0 30px rgba(59, 130, 246, 0.2)' }
        }
      }
    },
  },
  plugins: [],
}
