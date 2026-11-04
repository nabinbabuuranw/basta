/** Basta design tokens. Palette: Coolors "Sunrise Glow" 233D4D FE7F2D FCCA46 A1C181 619B8A (picked on Nabin's signed-in Coolors account) + derived. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#233D4D', 2: '#2F5063', soft: '#52626B' },
        pumpkin: { DEFAULT: '#FE7F2D', ink: '#A8471B', soft: '#FFE3CF' },
        sun: { DEFAULT: '#FCCA46', soft: '#FDEBB6' },
        sage: { DEFAULT: '#A1C181', soft: '#E3EDD6', ink: '#3F6B2A' },
        teal: { DEFAULT: '#619B8A', ink: '#3F6F61', soft: '#DCEAE5' },
        chalk: '#FBF5E9', card: '#FFFCF5', sunk: '#F3EBDB', line: '#E2D7C1', absent: '#B23A1E',
      },
      fontFamily: { display: ['"Baloo 2"', 'system-ui', 'sans-serif'], sans: ['"Atkinson Hyperlegible"', '"Baloo 2"', 'system-ui', 'sans-serif'] },
      borderRadius: { tag: '14px', pill: '999px', key: '10px' },
      boxShadow: { press: '3px 3px 0 0 #233D4D', pressSm: '2px 2px 0 0 #233D4D', lift: '0 1px 0 #233D4D' },
      maxWidth: { page: '1200px' },
      transitionTimingFunction: { bounce: 'cubic-bezier(.34,1.56,.64,1)', out: 'cubic-bezier(.2,.8,.2,1)' },
    },
  },
  plugins: [],
};
