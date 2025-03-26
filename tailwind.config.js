/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
      './src/components/**/*.{js,ts,jsx,tsx,mdx}',
      './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            DEFAULT: '#9B59B6', // Creative purple
            light: '#B39DFF',
            dark: '#7D3C98',
          },
          secondary: {
            DEFAULT: '#1ABC9C', // Modern teal
            light: '#2EE6C3',
            dark: '#169F85',
          },
          accent: {
            DEFAULT: '#FF6B6B', // Coral
            light: '#FF8E8E',
            dark: '#E64D4D',
          },
          background: {
            DEFAULT: '#FAFAFA', // Off-white
            dark: '#F0F0F0',
          },
        },
      },
    },
    plugins: [],
  }