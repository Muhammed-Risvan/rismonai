import { z } from "zod";
import { goalCreateSchema } from "./goals";
import { ambitionIdSchema } from "./ambitions";

/**
 * M2 onboarding: the smallest SMART-shaped input a new learner submits when
 * starting their first journey. Title intentionally reuses the goal limits.
 */
export const onboardingStartSchema = z
  .object({
    ambitionId: ambitionIdSchema,
    // Intended outcome — stored on the goal as target_outcome.
    outcome: z.string().min(1).max(500),
    // Available study time — stored on the goal as hours_per_week.
    hoursPerWeek: z.number().int().min(1).max(80),
    // Optional SMART extras — stored on the goal as-is.
    background: z.string().max(2000).nullable().optional(),
    deadline: goalCreateSchema.shape.deadline,
  })
  .strict();

export type OnboardingStartInput = z.infer<typeof onboardingStartSchema>;
