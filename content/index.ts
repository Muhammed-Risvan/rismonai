import {
  ambitionSchema,
  validateCompetencyMap,
  type Ambition,
  type AmbitionCatalogEntry,
} from "@/core/content";
import { cloudSecurityEngineerMap } from "./cloud-security-engineer";

export { cloudSecurityEngineerMap } from "./cloud-security-engineer";

/**
 * The ambition catalog (M0 seed).
 *
 * Each entry pairs a catalog `Ambition` with its reviewed `CompetencyMap`.
 * Entries are validated on module load, so a malformed map fails loudly here
 * (and in tests) rather than silently for a learner (spec.md §6).
 */

const CLOUD_SECURITY_ENGINEER: Ambition = {
  id: "cloud-security-engineer",
  name: "Cloud Security Engineer",
  description:
    "Learn to secure cloud workloads: shared responsibility, identity and access, network exposure, and detection — from a beginner starting point.",
  targetOutcome:
    "Demonstrate foundational cloud security capability across identity, network, and detection, with a reviewed first arc. Not a job guarantee.",
  level: "beginner",
};

function buildEntry(ambition: Ambition, mapInput: unknown): AmbitionCatalogEntry {
  const parsedAmbition = ambitionSchema.parse(ambition);
  const result = validateCompetencyMap(mapInput);
  if (!result.ok) {
    // Fail fast at load: a broken seed must never reach a learner.
    throw new Error(
      `Invalid competency map for "${ambition.id}": ${result.error}`,
    );
  }
  return { ambition: parsedAmbition, competencyMap: result.map };
}

/** All supported ambitions and their maps (M0: just the seed). */
export const AMBITION_CATALOG: readonly AmbitionCatalogEntry[] = [
  buildEntry(CLOUD_SECURITY_ENGINEER, cloudSecurityEngineerMap),
];

/** Look up a catalog entry by ambition id. */
export function getAmbitionEntry(
  ambitionId: string,
): AmbitionCatalogEntry | undefined {
  return AMBITION_CATALOG.find((entry) => entry.ambition.id === ambitionId);
}
