/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        c: {
          bg:       'rgb(var(--c-bg)   / <alpha-value>)',
          bg1:      'rgb(var(--c-bg1)  / <alpha-value>)',
          bg2:      'rgb(var(--c-bg2)  / <alpha-value>)',
          bg3:      'rgb(var(--c-bg3)  / <alpha-value>)',
          primary:  'rgb(var(--c-primary)   / <alpha-value>)',
          'primary-h': 'rgb(var(--c-primary-h) / <alpha-value>)',
          border:   'rgba(255,255,255,0.07)',
          'border-h': 'rgba(255,255,255,0.14)',
          green: '#22c55e',
          gold:  '#eab308',
          red:   '#ef4444',
          text:  '#fafafa',
          t2:    '#a1a1aa',
          t3:    '#52525b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
    },
  },
  plugins: [],
}
