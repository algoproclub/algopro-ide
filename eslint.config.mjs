import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import typescript from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
import playwright from 'eslint-plugin-playwright';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const typescriptFiles = ['src/**/*.{ts,tsx}', 'pages/**/*.{ts,tsx}'];
const jestFiles = [
  '**/__tests__/**/*.{js,jsx,ts,tsx}',
  '**/*.{test,spec}.{js,jsx,ts,tsx}',
];

export default defineConfig([
  globalIgnores([
    'node_modules/',
    '.next/',
    '.out/',
    'next-env.d.ts',
    'functions/node_modules/',
    'functions/lib/',

    // Legacy USACO code
    'src/components/JudgeInterface/USACOJudgeInterface.tsx',
    'src/components/settings/ProblemSearchInterface.tsx',
    'src/types/judge.d.ts',
    'src/types/react-split-grid.d.ts',
  ]),
  {
    name: 'javascript',
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    name: 'jest',
    files: jestFiles,
    extends: [jest.configs['flat/recommended']],
  },
  {
    name: 'playwright',
    files: ['e2e/**/*.{js,ts}'],
    extends: [playwright.configs['flat/recommended']],
  },
  {
    name: 'TypeScript config files',
    files: ['next.config.ts'],
    extends: [typescript.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    name: 'typescript and react',
    files: typescriptFiles,
    extends: [
      typescript.configs.recommendedTypeChecked,
      react.configs.flat.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      parser: typescript.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'jsx-a11y/anchor-is-valid': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
        },
      ],
      '@typescript-eslint/no-require-imports': [
        'error',
        {
          allow: ['dotenv'],
        },
      ],
      'no-prototype-builtins': 'warn',
      'prefer-const': [
        'error',
        {
          destructuring: 'all',
        },
      ],

      // FIXME: Transitional; these should be errors
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',

      // Too noisy
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
          },
        },
      ],
    },
  },
  {
    ...prettierRecommended,
    rules: {
      ...prettierRecommended.rules,
      'prettier/prettier': [
        'error',
        {},
        {
          usePrettierrc: true,
        },
      ],
    },
  },
]);
