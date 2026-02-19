/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './index.html'
  ],
  theme: {
    extend: {
      colors: {
        magic: {
          white: '#F9FAF4',
          blue: '#0E68AB',
          black: '#150B00',
          red: '#D3202A',
          green: '#00733E',
          gold: '#C8A84B',
          colorless: '#9FA3AD',
          bg: '#1a1a2e',
          surface: '#16213e',
          card: '#0f3460',
          accent: '#e94560',
          text: '#a8b2d8',
        }
      }
    }
  },
  plugins: []
}
