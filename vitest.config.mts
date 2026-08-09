import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Two suites:
 *  - `unit` covers the pure domain logic (calculations, validation, formats)
 *    and needs nothing but Node.
 *  - `integration` exercises the real server actions against a real Postgres
 *    and is skipped unless TEST_DATABASE_URL points at a throwaway database.
 *    See README "Running the tests".
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    projects: [
      {
        resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Each file gets its own user, but they share one database.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          setupFiles: ["tests/integration/setup.ts"],
        },
      },
    ],
  },
});
