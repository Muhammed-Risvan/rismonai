import type { CompetencyMap } from "./ambition";
import { InvalidCompetencyMapError } from "./dag";

/**
 * Pure referential-integrity validation for a competency map (M3, additive).
 *
 * The DAG validator (`dag.ts`) proves the capability prerequisite graph is
 * acyclic with no dangling edges. This module proves the *rest* of the map
 * hangs together: every objective/lesson/exercise/misconception references
 * ids that actually exist. Pure: no DB, network, or clock. Throws a
 * descriptive error so broken content fails loudly at load/test time.
 */

type ReferenceMapInput = Pick<
  CompetencyMap,
  "capabilities" | "objectives" | "lessons" | "exercises" | "misconceptions"
>;

/** Positional lookup used to assert `reprobeOf` points backwards in the map. */
function indexOf(exercises: readonly { id: string }[], id: string): number {
  return exercises.findIndex((exercise) => exercise.id === id);
}

/**
 * Asserts all cross-references in `map` resolve:
 * - every objective.capabilityIds[] → a real capability;
 * - every lesson.objectiveId → a real objective;
 * - every lesson.capabilityIds[] → a real capability;
 * - every exercise.capabilityIds[] → a real capability;
 * - every exercise.reprobeOf → a real, different exercise that sits earlier;
 * - every exercise.misconceptionSignatures[].misconceptionId → a real misconception;
 * - every misconception.capabilityId → a real capability.
 *
 * @throws InvalidCompetencyMapError naming the offending id.
 */
export function assertValidReferences(map: ReferenceMapInput): void {
  const capabilityIds = new Set(map.capabilities.map((c) => c.id));
  const objectiveIds = new Set(map.objectives.map((o) => o.id));
  const exerciseIds = new Set(map.exercises.map((e) => e.id));
  const misconceptionIds = new Set(map.misconceptions.map((m) => m.id));

  for (const objective of map.objectives) {
    for (const capabilityId of objective.capabilityIds) {
      if (!capabilityIds.has(capabilityId)) {
        throw new InvalidCompetencyMapError(
          `Objective "${objective.id}" references unknown capability "${capabilityId}"`,
        );
      }
    }
  }

  for (const lesson of map.lessons) {
    if (!objectiveIds.has(lesson.objectiveId)) {
      throw new InvalidCompetencyMapError(
        `Lesson "${lesson.id}" references unknown objective "${lesson.objectiveId}"`,
      );
    }
    for (const capabilityId of lesson.capabilityIds) {
      if (!capabilityIds.has(capabilityId)) {
        throw new InvalidCompetencyMapError(
          `Lesson "${lesson.id}" references unknown capability "${capabilityId}"`,
        );
      }
    }
  }

  for (const exercise of map.exercises) {
    for (const capabilityId of exercise.capabilityIds) {
      if (!capabilityIds.has(capabilityId)) {
        throw new InvalidCompetencyMapError(
          `Exercise "${exercise.id}" references unknown capability "${capabilityId}"`,
        );
      }
    }
    // A re-probe must point at a real, different, earlier item: a forward or
    // self reference could never fire, so it is a content bug, not a no-op.
    if (exercise.reprobeOf !== null) {
      if (!exerciseIds.has(exercise.reprobeOf)) {
        throw new InvalidCompetencyMapError(
          `Exercise "${exercise.id}" re-probes unknown exercise "${exercise.reprobeOf}"`,
        );
      }
      if (exercise.reprobeOf === exercise.id) {
        throw new InvalidCompetencyMapError(
          `Exercise "${exercise.id}" re-probes itself`,
        );
      }
      if (indexOf(map.exercises, exercise.reprobeOf) >= indexOf(map.exercises, exercise.id)) {
        throw new InvalidCompetencyMapError(
          `Exercise "${exercise.id}" re-probes "${exercise.reprobeOf}", which is not earlier in the map`,
        );
      }
    }
    for (const signature of exercise.misconceptionSignatures) {
      if (!misconceptionIds.has(signature.misconceptionId)) {
        throw new InvalidCompetencyMapError(
          `Exercise "${exercise.id}" signature references unknown misconception "${signature.misconceptionId}"`,
        );
      }
      // A signature must name a wrong answer, or it can never be detected.
      if (exercise.answerKey.accepted.includes(signature.answer)) {
        throw new InvalidCompetencyMapError(
          `Exercise "${exercise.id}" signature maps correct answer "${signature.answer}" to a misconception`,
        );
      }
    }
  }

  for (const misconception of map.misconceptions) {
    if (!capabilityIds.has(misconception.capabilityId)) {
      throw new InvalidCompetencyMapError(
        `Misconception "${misconception.id}" references unknown capability "${misconception.capabilityId}"`,
      );
    }
  }
}

/**
 * Boolean variant of {@link assertValidReferences}. Returns `true` when all
 * references resolve, `false` otherwise. Pure.
 */
export function isValidReferences(map: ReferenceMapInput): boolean {
  try {
    assertValidReferences(map);
    return true;
  } catch (error) {
    if (error instanceof InvalidCompetencyMapError) {
      return false;
    }
    throw error;
  }
}
