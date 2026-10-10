import { eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { learnerProfiles, type LearnerProfileRow } from "@/server/db/schema";

export async function selectProfileById(
  id: string,
): Promise<LearnerProfileRow | undefined> {
  const rows = await getDb()
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, id))
    .limit(1);
  return rows[0];
}

/**
 * Idempotent insert: creates the row on first call; on conflict it rewrites
 * the same primary key, returning the existing row unchanged (no other column
 * is touched, so created_at/updated_at stay as they are).
 */
export async function insertProfileIfMissing(
  id: string,
): Promise<LearnerProfileRow> {
  const rows = await getDb()
    .insert(learnerProfiles)
    .values({ id })
    .onConflictDoUpdate({ target: learnerProfiles.id, set: { id } })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create learner profile");
  }
  return row;
}

export async function updateProfileRow(
  id: string,
  patch: { displayName?: string | null; timezone?: string },
): Promise<LearnerProfileRow | undefined> {
  const values: {
    displayName?: string | null;
    timezone?: string;
    updatedAt: SQL;
  } = { updatedAt: sql`now()` };
  if (patch.displayName !== undefined) {
    values.displayName = patch.displayName;
  }
  if (patch.timezone !== undefined) {
    values.timezone = patch.timezone;
  }
  const rows = await getDb()
    .update(learnerProfiles)
    .set(values)
    .where(eq(learnerProfiles.id, id))
    .returning();
  return rows[0];
}