/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#002654', 900: '#001A3A', 800: '#002654', 700: '#0B3566', 600: '#1A4678' },
        steel: { DEFAULT: '#436C8A', 50: '#EEF3F7', 100: '#DCE6EE', 200: '#B7CBDA', 400: '#6F93AD', 600: '#365A74', 700: '#2B485D' },
        zinc: { logo: '#A7AAAC' },
        canvas: '#F5F6FA',
        ink: { DEFAULT: '#18212D', soft: '#4A5563', faint: '#7A8492' },
        line: '#E1E5EC',
        amber: { DEFAULT: '#E19619', 50: '#FDF5E7', 700: '#9A6409' },
        ok: { DEFAULT: '#2F7D5B', 50: '#E9F5EF' },
        bad: { DEFAULT: '#B4433A', 50: '#FBECEA' },
      },
      fontFamily: { sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'] },
      fontSize: { '2xs': ['0.6875rem', '1rem'] },
      boxShadow: { pop: '0 12px 32px -8px rgba(0,38,84,.28), 0 2px 6px rgba(0,38,84,.08)' },
    },
  },
  plugins: [],
}
