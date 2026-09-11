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
    './docs/**/*.mdx',
    './docs/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        gray: colors.neutral,
        // Public semantic palette. These names intentionally mirror Tailwind
        // v4's --color-* namespace so components will not need renaming later.
        canvas: 'var(--color-canvas)',
        panel: {
          DEFAULT: 'var(--color-panel)',
          muted: 'var(--color-panel-muted)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
          raised: 'var(--color-surface-raised)',
          hover: 'var(--color-surface-hover)',
          active: 'var(--color-surface-active)',
        },
        line: {
          DEFAULT: 'var(--color-line)',
          muted: 'var(--color-line-muted)',
          strong: 'var(--color-line-strong)',
        },
        content: {
          DEFAULT: 'var(--color-content)',
          secondary: 'var(--color-content-secondary)',
          muted: 'var(--color-content-muted)',
          disabled: 'var(--color-content-disabled)',
          inverted: 'var(--color-content-inverted)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          strong: 'var(--color-accent-strong)',
        },
        gutter: {
          DEFAULT: 'var(--color-gutter)',
          hover: 'var(--color-gutter-hover)',
        },
        focus: 'var(--color-focus)',
        control: 'var(--color-control)',
        input: 'var(--color-input)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        status: {
          success: {
            DEFAULT: 'var(--color-status-success)',
            surface: 'var(--color-status-success-surface)',
            content: 'var(--color-status-success-content)',
          },
          warning: {
            DEFAULT: 'var(--color-status-warning)',
            surface: 'var(--color-status-warning-surface)',
            content: 'var(--color-status-warning-content)',
          },
          danger: {
            DEFAULT: 'var(--color-status-danger)',
            surface: 'var(--color-status-danger-surface)',
            content: 'var(--color-status-danger-content)',
          },
          info: 'var(--color-status-info)',
          accent: {
            DEFAULT: 'var(--color-status-accent)',
            surface: 'var(--color-status-accent-surface)',
            content: 'var(--color-status-accent-content)',
          },
          neutral: {
            DEFAULT: 'var(--color-status-neutral)',
            surface: 'var(--color-status-neutral-surface)',
            content: 'var(--color-status-neutral-content)',
          },
        },
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
