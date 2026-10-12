import { z } from "zod";

/**
 * Shared Zod primitives for the learning-content contracts (M0).
 *
 * These mirror the branded id types in `src/core/identifiers.ts` at the
 * runtime/validation boundary. Content is authored as structured, versioned
 * data and validated on load; it is pure (no DB/network/clock).
 *
 * Id format: a non-empty, URL/filename-safe slug (lowercase letters, digits,
 * and hyphens). This keeps ids stable, human-readable, and safe to use as keys.
 */

/** Slug id used for all content ids (capabilities, objectives, lessons, …). */
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be a lowercase slug (letters, digits, single hyphens)",
  );

/** ISO date (YYYY-MM-DD) — matches the repo's existing `z.iso.date()` usage. */
export const isoDateSchema = z.iso.date();

/** A short semantic version string, e.g. "1.0.0". */
export const semverSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+$/,
    "must be a semantic version like 1.0.0",
  );

/** Proficiency band a piece of content targets (beginner → advanced). */
export const levelSchema = z.enum(["beginner", "intermediate", "advanced"]);
