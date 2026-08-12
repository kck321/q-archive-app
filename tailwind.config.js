/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        flash: {
          '0%, 100%': { backgroundColor: 'rgba(34,197,94,0.5)', color: '#dcfce7' },
          '50%':       { backgroundColor: 'transparent',        color: 'inherit'  },
        },
        'flash-red': {
          '0%, 100%': { backgroundColor: 'rgba(239,68,68,0.75)', color: '#ffffff' },
          '50%':       { backgroundColor: '#ffffff',             color: '#991b1b'  },
        },
        // Post-number chips pulse while their month is hovered on a timeline chart, so
        // you can see WHERE in a long list of post numbers that month's posts sit.
        // Runs infinitely because it lasts exactly as long as the hover does.
        'chip-pulse': {
          '0%, 100%': { backgroundColor: '#ffffff', color: '#0a0e1a', borderColor: '#ffffff' },
          '50%':       { backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.9)' },
        },
      },
      animation: {
        flash: 'flash 0.6s ease-in-out 3 forwards',
        'flash-red': 'flash-red 3s ease-in-out infinite',
        'chip-pulse': 'chip-pulse 0.7s ease-in-out infinite',
      },
      colors: {
        q: {
          dark: '#0a0e1a',
          panel: '#111827',
          border: '#1f2937',
          accent: '#9ca3af',
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}

