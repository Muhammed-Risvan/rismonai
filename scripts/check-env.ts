/**
 * Prints each environment variable NAME and whether it is "set" or "missing".
 * Values are NEVER printed.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DATABASE_MIGRATION_URL",
  "ALLOW_DB_TESTS",
  "AI_PROVIDER_API_KEY",
] as const;

for (const name of NAMES) {
  const status = process.env[name] ? "set" : "missing";
  console.log(`${name}: ${status}`);
}