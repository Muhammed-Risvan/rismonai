import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Purity guard for M0 core/content modules (acceptance criterion: "all new
 * modules pure — no DB/network/clock"). We statically scan the sources for
 * forbidden side-effect patterns. This is a lint-style test: it does not
 * execute the modules, it reads their text, so it needs no DB or network.
 *
 * Forbidden in pure core/content:
 * - imports of DB/network/server-only modules (postgres, drizzle, supabase,
 *   next, server-only, node:http(s)/net/fetch);
 * - direct clock access (Date.now(), new Date()) — time must be injected;
 *   (test files are excluded; only runtime sources under src/core + content).
 */

const PURE_ROOTS = ["src/core", "content"] as const;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (extname(full) === ".ts") {
      acc.push(full);
    }
  }
  return acc;
}

const FORBIDDEN_IMPORT =
  /from\s+["'](?:postgres|drizzle-orm[^"']*|@supabase[^"']*|next(?:\/[^"']*)?|server-only|node:(?:http|https|net|dgram|tls)|node:fs|node:child_process)["']/;

const FORBIDDEN_CLOCK = /\bDate\.now\s*\(|\bnew\s+Date\s*\(/;

describe("pure core/content modules", () => {
  const files = PURE_ROOTS.flatMap((root) => collectSourceFiles(root));

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no DB/network/server-only imports", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (FORBIDDEN_IMPORT.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("contains no direct clock access (time must be injected)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (FORBIDDEN_CLOCK.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
