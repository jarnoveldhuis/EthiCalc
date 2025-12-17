/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: (() => {
        // Neutral gray scale
        const neutralMono = {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        };

        // Darker bias (for "positive" families)
        const positiveMono = {
          50: '#F5F5F5',
          100: '#E5E5E5',
          200: '#D4D4D4',
          300: '#A3A3A3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#262626',
          800: '#171717',
          900: '#0A0A0A',
        };

        // Lighter bias (for "negative/warning" families)
        const negativeMono = {
          50: '#FFFFFF',
          100: '#FAFAFA',
          200: '#F5F5F5',
          300: '#E5E5E5',
          400: '#D4D4D4',
          500: '#BDBDBD',
          600: '#9E9E9E',
          700: '#7A7A7A',
          800: '#616161',
          900: '#4B4B4B',
        };

        return {
          // App semantic colors mapped to monochrome
          primary: {
            DEFAULT: '#000000',
            light: '#333333',
            dark: '#000000',
          },
          secondary: {
            DEFAULT: '#F5F5F5',
            light: '#FAFAFA',
            dark: '#E5E5E5',
          },
          accent: {
            DEFAULT: '#E5E5E5',
            light: '#F3F4F6',
            dark: '#D1D5DB',
          },
          background: {
            DEFAULT: '#FFFFFF',
            dark: '#000000',
          },

          // Distinct mappings:
          // Positive-leaning families -> darker scale
          green: positiveMono,
          emerald: positiveMono,
          lime: positiveMono,
          teal: positiveMono,
          cyan: positiveMono,

          // Negative/warning families -> lighter scale
          red: negativeMono,
          rose: negativeMono,
          orange: negativeMono,
          amber: negativeMono,
          yellow: negativeMono,
          pink: negativeMono,
          fuchsia: negativeMono,

          // Neutral info families -> neutral gray
          blue: neutralMono,
          indigo: neutralMono,
          violet: neutralMono,
          purple: neutralMono,
          sky: neutralMono,
        };
      })(),
    },
  },
  plugins: [],
}