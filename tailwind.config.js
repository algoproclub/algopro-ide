const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    './src/**/*.js',
    './src/**/*.ts',
    './src/**/*.tsx',
    './pages/**/*.js',
    './pages/**/*.ts',
    './pages/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        gray: colors.neutral,
        'custom-blue': 'rgb(53,103,118)',
      },
      backgroundColor: {
        'custom-blue': 'rgb(53,103,118)',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    plugin(function ({ addBase, theme }) {
      addBase({
        h1: {
          fontSize: theme('fontSize.2xl'),
          fontWeight: theme('fontWeight.semibold'),
          margin: '1rem 0 1rem 0',
        },
        h2: {
          fontSize: theme('fontSize.xl'),
          fontWeight: theme('fontWeight.semibold'),
          margin: '0.5rem 0 0.5rem 0',
        },
        h3: {
          fontSize: theme('fontSize.lg'),
          fontWeight: theme('fontWeight.semibold'),
          margin: '0.5rem 0 0.25rem 0',
        },
      });
    }),
  ],
};
