import { z } from "zod";
import { levelSchema, slugSchema } from "./primitives";

/**
 * Learning-content contracts (M0). Pure Zod schemas + inferred TypeScript
 * types describing the structured, versioned curriculum data for an ambition.
 *
 * Design rules (from spec.md §6):
 * - Capabilities form a prerequisite DAG (validated separately in `dag.ts`).
 * - Lessons teach one concept; exercises have deterministic answer keys.
 * - Misconceptions map a signature to a remediation.
 * - Content carries a version + lastReviewed date for accuracy review.
 *
 * These schemas validate *shape*; semantic rules (prerequisite cycles, dangling
 * references, answer-key integrity) are enforced by the pure validators in
 * `dag.ts` and `content-map.ts`. No DB/network/clock.
 */

/** A single learnable/provable capability (a node in the competency map). */
export const capabilitySchema = z
  .object({
    id: slugSchema,
    title: z.string().min(1).max(200),
    /** Why this capability matters (feeds lesson "why it matters"). */
    summary: z.string().min(1).max(1000),
    level: levelSchema,
    /** Ids of capabilities that should be demonstrated before this one. */
    prerequisites: z.array(slugSchema).default([]),
  })
  .strict();

export type Capability = z.infer<typeof capabilitySchema>;

/** A SMART learning objective tied to one or more capabilities. */
export const objectiveSchema = z
  .object({
    id: slugSchema,
    title: z.string().min(1).max(200),
    /** Specific, measurable statement of what the learner will be able to do. */
    statement: z.string().min(1).max(1000),
    capabilityIds: z.array(slugSchema).min(1),
  })
  .strict();

export type Objective = z.infer<typeof objectiveSchema>;

/** One focused lesson for a single concept. */
export const lessonSchema = z
  .object({
    id: slugSchema,
    title: z.string().min(1).max(200),
    objectiveId: slugSchema,
    capabilityIds: z.array(slugSchema).min(1),
    /** Why it matters, the analogy, the visual, and a worked example. */
    whyItMatters: z.string().min(1).max(2000),
    analogy: z.string().min(1).max(2000),
    /** Optional visual reference (e.g. a diagram key handled by the UI). */
    visual: z.string().max(500).nullable().optional(),
    example: z.string().min(1).max(4000),
  })
  .strict();

export type Lesson = z.infer<typeof lessonSchema>;

/** Deterministic answer key for an exercise item. */
export const answerKeySchema = z
  .object({
    /** The accepted answer(s); grading is exact/normalized match in a later MS. */
    accepted: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type AnswerKey = z.infer<typeof answerKeySchema>;

/** A practice/assessment item with a deterministic answer key. */
export const exerciseSchema = z
  .object({
    id: slugSchema,
    prompt: z.string().min(1).max(2000),
    capabilityIds: z.array(slugSchema).min(1),
    /** Whether this item is used for guided practice or independent assessment. */
    kind: z.enum(["practice", "assessment"]),
    answerKey: answerKeySchema,
    /** Optional hints (only surfaced in guided mode). */
    hints: z.array(z.string().min(1).max(500)).max(5).default([]),
  })
  .strict();

export type Exercise = z.infer<typeof exerciseSchema>;

/** A known misconception: a wrong-answer signature mapped to a remediation. */
export const misconceptionSchema = z
  .object({
    id: slugSchema,
    capabilityId: slugSchema,
    /** Human description of the misunderstanding. */
    description: z.string().min(1).max(1000),
    /** How to correct it (feeds revision). */
    remediation: z.string().min(1).max(2000),
  })
  .strict();

export type Misconception = z.infer<typeof misconceptionSchema>;
