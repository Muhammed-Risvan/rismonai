import { ZodError } from "zod";
import { competencyMapSchema, type CompetencyMap } from "./ambition";
import { assertValidPrerequisiteDag } from "./dag";
import { assertValidReferences } from "./references";

/**
 * Validate an unknown value as a full CompetencyMap: Zod shape validation
 * first, then semantic prerequisite-DAG validation. Pure (no DB/network/clock).
 *
 * Returns a discriminated result so callers can branch without try/catch and so
 * content-load code can fail loudly with a precise message.
 */
export type CompetencyMapValidation =
  | { ok: true; map: CompetencyMap }
  | { ok: false; error: string };

export function validateCompetencyMap(
  input: unknown,
): CompetencyMapValidation {
  const parsed = competencyMapSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  try {
    assertValidPrerequisiteDag(parsed.data.capabilities);
    assertValidReferences(parsed.data);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid competency map",
    };
  }
  return { ok: true, map: parsed.data };
}

/** Flattens a ZodError into a single readable line (no secrets involved). */
export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
