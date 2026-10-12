import { z } from "zod";

/**
 * Catalog ambition id (matches the M0 slug contract used for ambition ids).
 * Used by services that accept an ambition id (e.g. linking a goal).
 */
export const ambitionIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase slug");

/** PATCH body for linking/unlinking a goal's ambition (service-level input). */
export const goalAmbitionSchema = z
  .object({
    ambitionId: ambitionIdSchema.nullable(),
  })
  .strict();

export type GoalAmbitionInput = z.infer<typeof goalAmbitionSchema>;
