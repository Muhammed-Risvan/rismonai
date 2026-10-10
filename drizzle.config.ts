import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local for DATABASE_MIGRATION_URL. Values are never printed.
dotenv.config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "src/server/db/schema.ts",
  out: "drizzle",
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? "",
  },
  strict: true,
  verbose: true,
});