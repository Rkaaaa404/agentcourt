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
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        court: {
          dark: '#030712',
          surface: '#0B1120',
          card: '#0F172A',
          border: '#1E293B',
          primary: '#0EA5E9',
          accent: '#38BDF8',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        }
      }
    },
  },
  plugins: [],
}
