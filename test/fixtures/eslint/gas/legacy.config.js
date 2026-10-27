import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig(
  // peer/ holds ambient declarations for consumers to copy; it's outside
  // tsconfig's `include`, so project-based linting can't resolve it.
  { ignores: ['dist/**', '.worktrees/**', 'peer/**'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend GAS files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      sourceType: 'script', // no import/export — GAS files share one global scope
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Vitest suite — ES modules running on Node.
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
      parserOptions: {
        project: './tsconfig.test.json',
      },
    },
  },

  eslintConfigPrettier,
);
