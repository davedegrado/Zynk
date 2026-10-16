import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests share one database and truncate between cases.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
