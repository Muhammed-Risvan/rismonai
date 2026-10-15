import { z } from "zod";
import { slugSchema } from "../content/primitives";
import type { Exercise } from "../content/schema";
import type { DiagnosticBank } from "./bank";

/**
 * M3 immutable run snapshot schema (pure).
 *
 * An in-progress run resumes against the EXACT content version it started
 * with — prompts, capability bindings, accepted answers, order, and
 * conditional metadata are frozen per run in `diagnostic_runs.items_snapshot`
 * (JSONB). A newer catalog release never reorders or re-grades a live run;
 * new runs snapshot the new version.
 *
 * Safeguards:
 * - Validated with this strict schema when a run is created AND every time
 *   a run is loaded for grading or resume. Malformed snapshots are rejected
 *   with a safe server error before any grading happens.
 * - Accepted answers and misconception signatures are server-only: route
 *   DTOs must strip both `accepted` and `misconceptionSignatures` (and must
 *   never accept client-supplied correctness, capability ids, accepted
 *   answers, misconception ids, or learner ids).
 */

export const MAX_SNAPSHOT_ITEMS = 12;

export const diagnosticSnapshotItemSchema = z
  .object({
    itemId: slugSchema,
    capabilityId: slugSchema,
    prompt: z.string().min(1).max(2000),
    accepted: z.array(z.string().min(1)).min(1),
    /**
     * Misconception signatures frozen alongside the answer key, so a wrong
     * answer is graded against the SAME content version the run started with.
     * Without this, a later content release would retroactively change which
     * answers are attributable to a misconception.
     */
    misconceptionSignatures: z
      .array(
        z
          .object({
            answer: z.string().min(1),
            misconceptionId: slugSchema,
          })
          .strict(),
      )
      .default([]),
    position: z.number().int().min(0),
    conditionalOn: slugSchema.nullable(),
  })
  .strict();

export type DiagnosticSnapshotItem = z.infer<
  typeof diagnosticSnapshotItemSchema
>;

export const diagnosticSnapshotSchema = z
  .array(diagnosticSnapshotItemSchema)
  .min(1)
  .max(MAX_SNAPSHOT_ITEMS)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.itemId)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate snapshot item id: "${item.itemId}"`,
        });
      }
      seen.add(item.itemId);
      if (item.position !== index) {
        ctx.addIssue({
          code: "custom",
          message: `Snapshot position mismatch at index ${index}: expected ${index}, got ${item.position}`,
        });
      }
      if (item.conditionalOn !== null) {
        const triggerIndex = items.findIndex(
          (other) => other.itemId === item.conditionalOn,
        );
        if (triggerIndex === -1) {
          ctx.addIssue({
            code: "custom",
            message: `Snapshot item "${item.itemId}" has an unknown conditional trigger "${item.conditionalOn}"`,
          });
        } else if (triggerIndex >= index) {
          ctx.addIssue({
            code: "custom",
            message: `Snapshot item "${item.itemId}" has a conditional trigger "${item.conditionalOn}" that does not precede it`,
          });
        }
      }
      // A signature naming an accepted answer could never fire, and would mean
      // a correct answer could be recorded as a misconception.
      for (const signature of item.misconceptionSignatures) {
        if (item.accepted.includes(signature.answer)) {
          ctx.addIssue({
            code: "custom",
            message: `Snapshot item "${item.itemId}" maps correct answer "${signature.answer}" to a misconception`,
          });
        }
      }
    });
  });

export type DiagnosticSnapshot = z.infer<typeof diagnosticSnapshotSchema>;

/**
 * Freezes a bank + its exercises into snapshot items. Throws when a bank
 * item has no matching exercise in the map (content bug — fail loudly at
 * run creation, never mid-run for a learner).
 */
export function buildItemsSnapshot(
  bank: DiagnosticBank,
  exercises: readonly Exercise[],
): DiagnosticSnapshotItem[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return bank.entries.map((entry) => {
    const exercise = byId.get(entry.itemId);
    if (!exercise) {
      throw new Error(
        `Diagnostic bank item "${entry.itemId}" has no matching exercise in the map`,
      );
    }
    return {
      itemId: entry.itemId,
      capabilityId: entry.capabilityId,
      prompt: exercise.prompt,
      accepted: [...exercise.answerKey.accepted],
      misconceptionSignatures: exercise.misconceptionSignatures.map(
        (signature) => ({ ...signature }),
      ),
      position: entry.position,
      conditionalOn: entry.conditionalOn,
    };
  });
}
