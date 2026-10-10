import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // prepare: false is required by the Supabase transaction pooler (port 6543).
  // max: 1 keeps the pool small; each serverless instance needs only one
  // connection at a time.
  const client = postgres(url, { prepare: false, max: 1 });
  return drizzle(client, { schema });
}

let db: Db | undefined;

/**
 * Lazy singleton so importing this module never needs env vars or a live
 * connection: `pnpm build` and unit tests can import it safely.
 */
export function getDb(): Db {
  db ??= createDb();
  return db;
}