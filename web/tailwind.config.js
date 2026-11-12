/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Newsreader"', 'Georgia', 'Cambria', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        editorial: {
          bg: '#F8F3EB',
          surface: '#FFFFFF',
          stone: '#F2EBE0',
          border: '#DCCDBB',
          burgundy: '#541827',
          burgundyDeep: '#42121E',
          terracotta: '#BF4827',
          terracottaHover: '#A33B1E',
          ink: '#292522',
          muted: '#6E635D',
        }
      }
    },
  },
  plugins: [],
}
