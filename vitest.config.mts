import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const contentDir = fileURLToPath(new URL("./content", import.meta.url));
const emptyModule = fileURLToPath(
  new URL("./tests/helpers/empty-module.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      // Mirrors the "@/*" path alias in tsconfig.json.
      { find: "@", replacement: srcDir },
      // Mirrors the "@content/*" path alias (repo-root curriculum data).
      { find: "@content", replacement: contentDir },
      // `server-only` throws outside React Server Components; tests run in
      // plain Node, so alias it to an empty module.
      { find: /^server-only$/, replacement: emptyModule },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // A plain `pnpm test` must never touch the database, so the DB integration
    // suite is excluded here and run only via `pnpm test:db` (which uses
    // vitest.db.config.mts and sets ALLOW_DB_TESTS=true itself).
    exclude: [...configDefaults.exclude, "tests/db-integration.test.ts"],
    environment: "node",
    // DB round-trips are slow, but this config excludes the DB suite; the
    // higher timeout matters only for test:db (see vitest.db.config.mts).
    testTimeout: 30_000,
  },
});