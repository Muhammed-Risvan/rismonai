import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/**
 * An open transaction handle obtained from `Db.transaction`. It exposes the
 * same query surface as `Db`, so data-access functions may accept either via
 * `DbOrTx`. Never mix them inside a transaction: the pool is `max: 1`, so a
 * `getDb()` query issued while a transaction is open would wait forever for
 * the connection the transaction itself holds (self-deadlock).
 */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | DbTx;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // prepare: false is required by the Supabase transaction pooler (port 6543).
  // max: 1 keeps the pool small; each serverless instance needs only one
  // connection at a time. connect_timeout: 10 makes an unreachable pooler
  // fail in seconds — without it a dropped connection makes every query queue
  // for minutes (observed ~9-minute page loads) until the platform's own
  // statement_timeout reaps the wait.
  const client = postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });
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