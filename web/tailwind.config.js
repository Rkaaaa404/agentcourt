/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        veripact: {
          blue: '#1D6CE0',
          blueDark: '#1558BA',
          ice: '#EFF6FF',
          surface: '#F8FAFC',
          border: '#E2E8F0',
          ink: '#0F172A',
          muted: '#475569',
        }
      }
    },
  },
  plugins: [],
}
