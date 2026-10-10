/**
 * A brand-new, direct PostgreSQL connection for DB integration tests.
 *
 * This is deliberately separate from the app's lazy `getDb()` singleton so
 * tests can (a) prove data is committed by reading it over a fresh connection,
 * and (b) run raw INSERTs that bypass the service layer to exercise database
 * constraints. Connection strings are NEVER printed.
 *
 * This helper lives ONLY under tests/ and is never imported by app code.
 */
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/** Opens a new postgres.js connection using DATABASE_URL (prepare: false). */
export function createRawClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set");
  }
  // prepare: false works with both the transaction and the session pooler.
  return postgres(url, { prepare: false, max: 1 });
}

export type RawClient = ReturnType<typeof createRawClient>;
