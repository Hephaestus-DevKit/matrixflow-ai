// ESLint 根配置 (扁平配置)
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const nextConfigs = compat.extends('next/core-web-vitals').map((config) => ({
  ...config,
  files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
}));

export default [
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/generated/**'],
  },
  js.configs.recommended,
  ...nextConfigs,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'warn',
    },
  },
];
