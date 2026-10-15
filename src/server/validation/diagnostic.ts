import { z } from "zod";
import { ambitionIdSchema } from "./ambitions";

/**
 * M3 diagnostic boundary validation.
 *
 * The client may submit ONLY: which run (uuid) and which item (slug) plus
 * the raw response text. Correctness, capability ids, accepted answers, and
 * learner ids are NEVER accepted — the server derives all of them from the
 * validated immutable run snapshot.
 */

export const diagnosticRunIdSchema = z.uuid();

/** POST answer body: run + item + raw response only. */
export const diagnosticAnswerSchema = z
  .object({
    runId: diagnosticRunIdSchema,
    itemId: ambitionIdSchema,
    response: z.string().min(1).max(500),
  })
  .strict();

/** Opt-out / reassess bodies carry only the run reference (reassess: none). */
export const diagnosticOptOutSchema = z
  .object({
    runId: diagnosticRunIdSchema,
  })
  .strict();

export type DiagnosticAnswerInput = z.infer<typeof diagnosticAnswerSchema>;
export type DiagnosticOptOutInput = z.infer<typeof diagnosticOptOutSchema>;
