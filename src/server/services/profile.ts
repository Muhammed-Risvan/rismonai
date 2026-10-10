import {
  insertProfileIfMissing,
  selectProfileById,
  updateProfileRow,
} from "@/server/data/profiles";
import { NotFoundError } from "@/server/errors";
import type { LearnerProfileRow } from "@/server/db/schema";
import type { ProfileUpdateInput } from "@/server/validation/profile";

/**
 * Creates the learner's profile row on the first authenticated request.
 * Idempotent: a second call changes nothing.
 */
export async function ensureProfile(
  learnerId: string,
): Promise<LearnerProfileRow> {
  const existing = await selectProfileById(learnerId);
  if (existing) {
    return existing;
  }
  return insertProfileIfMissing(learnerId);
}

/** Returns the profile or null. Never throws for missing rows. */
export async function getProfile(
  learnerId: string,
): Promise<LearnerProfileRow | null> {
  return (await selectProfileById(learnerId)) ?? null;
}

/**
 * Updates display_name and/or timezone for the authenticated learner only.
 * Timezone must be a real IANA timezone (enforced by the Zod schema).
 */
export async function updateProfile(
  learnerId: string,
  input: ProfileUpdateInput,
): Promise<LearnerProfileRow> {
  await ensureProfile(learnerId);

  const patch: { displayName?: string | null; timezone?: string } = {};
  if (input.display_name !== undefined) {
    patch.displayName = input.display_name;
  }
  if (input.timezone !== undefined) {
    patch.timezone = input.timezone;
  }

  if (Object.keys(patch).length === 0) {
    const current = await selectProfileById(learnerId);
    if (!current) {
      throw new NotFoundError();
    }
    return current;
  }

  const updated = await updateProfileRow(learnerId, patch);
  if (!updated) {
    throw new NotFoundError();
  }
  return updated;
}