import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The release and bundle suites spawn git and child CLIs; under a full
    // parallel run they exceed vitest's 5s default.
    testTimeout: 30_000,
  },
});
