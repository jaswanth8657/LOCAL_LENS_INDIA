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
          saffron: '#FF7722',
          spice: '#FF9E1B',
          amber: '#F59E0B',
          teal: '#0D9488',
          peacock: '#0284C7',
          indigo: '#4F46E5',
          rose: '#E11D48',
          forest: '#059669',
          dark: '#0A0E1A',
          card: 'rgba(15, 23, 42, 0.75)',
          surface: '#0F172A',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'aurora-glow': 'radial-gradient(circle at 50% 0%, rgba(255, 119, 34, 0.15), rgba(79, 70, 229, 0.1) 40%, transparent 70%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-saffron': '0 0 25px -5px rgba(255, 119, 34, 0.4)',
        'glow-teal': '0 0 25px -5px rgba(13, 148, 136, 0.4)',
        'glow-indigo': '0 0 25px -5px rgba(79, 70, 229, 0.4)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}

