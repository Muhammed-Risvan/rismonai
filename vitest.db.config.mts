import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const emptyModule = fileURLToPath(
  new URL("./tests/helpers/empty-module.ts", import.meta.url),
);

/**
 * DB integration test config, used only by `pnpm test:db`.
 *
 * It runs ONLY the DB integration suite and sets ALLOW_DB_TESTS=true itself
 * (via `env`), so the gate does not depend on `.env.local`. A plain `pnpm test`
 * uses vitest.config.mts, which excludes this file entirely and never opens a
 * database connection.
 */
export default defineConfig({
  resolve: {
    alias: [
      // Mirrors the "@/*" path alias in tsconfig.json.
      { find: "@", replacement: srcDir },
      { find: /^server-only$/, replacement: emptyModule },
    ],
  },
  test: {
    include: ["tests/db-integration.test.ts"],
    environment: "node",
    // Many sequential network + DB round-trips; the default 5s is too tight.
    testTimeout: 30_000,
    // Set the gate here so `pnpm test:db` is self-contained.
    env: { ALLOW_DB_TESTS: "true" },
  },
});
