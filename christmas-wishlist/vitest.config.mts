import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/rls/**/*.test.ts"],
    setupFiles: ["tests/rls/env.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The tests share one local database; run files one at a time.
    fileParallelism: false,
  },
});
