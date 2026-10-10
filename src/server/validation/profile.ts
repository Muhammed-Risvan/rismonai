import { z } from "zod";
import { isValidTimeZone } from "@/lib/timezone";

/**
 * PATCH /api/profile body. Strict: unknown keys — including any learner_id —
 * are rejected. The learner id always comes from the verified session.
 */
export const profileUpdateSchema = z
  .object({
    display_name: z.string().max(80).nullable().optional(),
    timezone: z
      .string()
      .refine(isValidTimeZone, { message: "Invalid IANA timezone" })
      .optional(),
  })
  .strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;