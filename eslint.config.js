import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig(
  { ignores: ['.worktrees/**', 'node_modules/**', 'test/fixtures/**'] },

  eslint.configs.recommended,

  // Node.js CLI, library and tests — ESM with Node globals.
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },

  eslintConfigPrettier,
);
