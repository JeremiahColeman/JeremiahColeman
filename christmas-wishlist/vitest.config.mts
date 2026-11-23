import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          setupFiles: ["tests/rls/env.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // The tests share one local database; run files one at a time.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], testTimeout: 15_000 },
      },
    ],
  },
});
