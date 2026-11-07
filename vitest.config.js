import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The release and bundle suites spawn git and child CLIs; under a full
    // parallel run they exceed vitest's 5s default.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js', 'bin/**/*.js'],
      exclude: ['**/*.d.ts'],
      reporter: ['text-summary'],
      // Floor to ratchet up as coverage grows, not a target.
      thresholds: { statements: 55, branches: 48, functions: 59, lines: 57 },
    },
  },
});
