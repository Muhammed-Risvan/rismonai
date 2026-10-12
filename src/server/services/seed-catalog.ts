import { AMBITION_CATALOG } from "@content";
import { seedAmbition } from "@/server/services/ambitions";

/**
 * Seeds the `ambitions` catalog table from `content/` (M1).
 *
 * Idempotent: each entry is upserted by its stable slug id, so running this
 * repeatedly never duplicates rows and keeps catalog fields in sync with
 * `content/`. Server-side only (uses the Drizzle connection). Called lazily
 * (e.g. before listing ambitions) rather than on every request.
 *
 * Only the `Ambition` fields are persisted here; the competency map stays in
 * `content/` (authored data), not the database.
 */
export async function seedAmbitionCatalog(): Promise<{ seeded: number }> {
  let seeded = 0;
  for (const entry of AMBITION_CATALOG) {
    await seedAmbition({
      id: entry.ambition.id,
      name: entry.ambition.name,
      description: entry.ambition.description,
      targetOutcome: entry.ambition.targetOutcome,
      level: entry.ambition.level,
    });
    seeded += 1;
  }
  return { seeded };
}
