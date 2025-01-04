module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  parserOptions: { ecmaVersion: 8, sourceType: 'module' }, // to enable features such as async/await
  ignorePatterns: [
    'node_modules/*',
    '.next/*',
    '.out/*',
    '!.prettierrc.js',
    'functions/node_modules/*',
    'functions/lib/*',

    // Legacy USACO code
    'src/components/JudgeInterface/USACOJudgeInterface.tsx',
    'src/components/settings/ProblemSearchInterface.tsx',
    'src/hooks/useJudgeResults.ts',
    'src/types/judge.d.ts',
  ], // We don't want to lint generated files nor node_modules, but we want to lint .prettierrc.js (ignored by default by eslint)
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:jest/recommended',
    'plugin:jest-playwright/recommended',
  ],
  plugins: [
    // todo maybe only for jest files?
    'jest-playwright',
  ],
  overrides: [
    // This configuration will apply only to TypeScript files
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      settings: { react: { version: 'detect' } },
      env: {
        browser: true,
        node: true,
        es6: true,
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended', // TypeScript rules
        'plugin:react/recommended', // React rules
        'plugin:react-hooks/recommended', // React hooks rules
      ],
      rules: {
        // We will use TypeScript's types for component props instead
        'react/prop-types': 'off',

        // No need to import React when using Next.js
        'react/react-in-jsx-scope': 'off',

        // This rule is not compatible with Next.js's <Link /> components
        'jsx-a11y/anchor-is-valid': 'off',

        // Why would you want unused vars?
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', caughtErrors: 'none' },
        ],

        '@typescript-eslint/no-empty-function': 'off',

        '@typescript-eslint/no-non-null-assertion': 'off',

        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-expect-error': 'allow-with-description' },
        ],

        '@typescript-eslint/no-require-imports': [
          'error',
          { allow: ['dotenv'] },
        ],

        // Includes .prettierrc.js rules
        'prettier/prettier': ['error', {}, { usePrettierrc: true }],

        'no-prototype-builtins': 'warn',
      },
    },
  ],
};
