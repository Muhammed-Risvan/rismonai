import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const emptyModule = fileURLToPath(
  new URL("./tests/helpers/empty-module.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      // Mirrors the "@/*" path alias in tsconfig.json.
      { find: "@", replacement: srcDir },
      // `server-only` throws outside React Server Components; tests run in
      // plain Node, so alias it to an empty module.
      { find: /^server-only$/, replacement: emptyModule },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});