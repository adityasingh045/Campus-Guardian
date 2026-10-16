/** @type {import('tailwindcss').Config} */

// Each color scale points at CSS variables defined in src/index.css so the
// whole UI re-skins itself when <html data-theme="light|dark"> changes.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const varScale = (name) =>
  Object.fromEntries(SHADES.map((k) => [k, `rgb(var(--${name}-${k}) / <alpha-value>)`]))

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: varScale('slate'),
        red: varScale('red'),
        emerald: varScale('emerald'),
        amber: varScale('amber'),
        teal: varScale('teal'),
        cyan: varScale('cyan'),
        blue: varScale('blue'),
        safe: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}