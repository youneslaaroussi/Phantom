/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./components/**/*.{tsx,ts}", "./lib/**/*.{tsx,ts}", "./*.{tsx,ts,html}"],
  theme: {
    extend: {
      colors: {
        g: {
          blue: '#4285F4',
          'blue-hover': '#3367d6',
          'blue-bg': '#e8f0fe',
          'blue-light': '#d2e3fc',
          red: '#EA4335',
          'red-bg': '#fce8e6',
          yellow: '#FBBC05',
          'yellow-bg': '#fef7e0',
          green: '#34A853',
          'green-bg': '#e6f4ea',
          surface: '#ffffff',
          'surface-dim': '#f8f9fa',
          'surface-container': '#f1f3f4',
          'surface-container-high': '#e8eaed',
          'on-surface': '#1f1f1f',
          'on-surface-variant': '#444746',
          outline: '#747775',
          'outline-variant': '#c4c7c5',
        },
      },
      fontFamily: {
        google: ["'Google Sans'", "'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
        'google-text': ["'Google Sans Text'", "'Google Sans'", "'Segoe UI'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        'g-sm': '8px',
        'g-md': '16px',
        'g-lg': '28px',
        'g-full': '100px',
      },
    },
  },
  plugins: [],
}
