import { z } from "zod";

export const goalStatusSchema = z.enum([
  "active",
  "paused",
  "archived",
  "completed",
]);

/** POST /api/goals body. The server decides the status — clients cannot. */
export const goalCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    target_outcome: z.string().max(500).nullable().optional(),
    deadline: z.iso.date().nullable().optional(),
    hours_per_week: z.number().int().min(1).max(80).nullable().optional(),
    /**
     * Optional catalog ambition this journey pursues. Without it the goal
     * exists but no roadmap or diagnostic can be attached (the learner would
     * be stuck at "no-ambition"), so the dashboard lets them link one later
     * via PATCH /api/goals/[id]/ambition.
     */
    ambition_id: z.string().min(1).max(120).nullable().optional(),
  })
  .strict();

/** PATCH /api/goals/[id] body — editable fields only, no status, no learner_id. */
export const goalUpdateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    target_outcome: z.string().max(500).nullable().optional(),
    deadline: z.iso.date().nullable().optional(),
    hours_per_week: z.number().int().min(1).max(80).nullable().optional(),
  })
  .strict();

/** POST /api/goals/[id]/status body. */
export const goalStatusChangeSchema = z
  .object({
    status: goalStatusSchema,
  })
  .strict();

/** Route parameter for /api/goals/[id]. */
export const goalIdSchema = z.uuid();

export type GoalCreateInput = z.infer<typeof goalCreateSchema>;
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;
export type GoalStatusChangeInput = z.infer<typeof goalStatusChangeSchema>;