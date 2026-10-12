import { z } from "zod";
import { isoDateSchema, semverSchema, slugSchema } from "./primitives";
import {
  capabilitySchema,
  exerciseSchema,
  lessonSchema,
  misconceptionSchema,
  objectiveSchema,
} from "./schema";

/**
 * The full competency map + curriculum bundle for one ambition (M0).
 *
 * A `CompetencyMap` is the top-level, versioned content unit that the learning
 * engine consumes: capabilities (the DAG), objectives, lessons, exercises, and
 * misconceptions, all scoped to a single ambition. It is pure data validated on
 * load. Semantic integrity (prerequisite cycles/dangling refs, referential
 * integrity of objective/lesson/exercise/misconception ids) is enforced by the
 * pure validators in `dag.ts` and `content-map.ts`.
 */
export const competencyMapSchema = z
  .object({
    ambitionId: slugSchema,
    version: semverSchema,
    /** ISO date this content was last reviewed for accuracy. */
    lastReviewed: isoDateSchema,
    capabilities: z.array(capabilitySchema).min(1),
    objectives: z.array(objectiveSchema).default([]),
    lessons: z.array(lessonSchema).default([]),
    exercises: z.array(exerciseSchema).default([]),
    misconceptions: z.array(misconceptionSchema).default([]),
  })
  .strict();

export type CompetencyMap = z.infer<typeof competencyMapSchema>;

/** A catalog entry describing an ambition the product supports. */
export const ambitionSchema = z
  .object({
    id: slugSchema,
    /** Display name, e.g. "Cloud Security Engineer". */
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(2000),
    /** The reviewed job-readiness target, stated honestly and bounded. */
    targetOutcome: z.string().min(1).max(500),
    level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  })
  .strict();

export type Ambition = z.infer<typeof ambitionSchema>;

/** An ambition paired with its competency map (the loadable catalog unit). */
export const ambitionCatalogEntrySchema = z
  .object({
    ambition: ambitionSchema,
    competencyMap: competencyMapSchema,
  })
  .strict();

export type AmbitionCatalogEntry = z.infer<typeof ambitionCatalogEntrySchema>;
