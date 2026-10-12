import type { Capability } from "./schema";

/**
 * Pure prerequisite-DAG validation for a competency map (M0).
 *
 * Enforces (spec.md §6): the capability prerequisites form a directed acyclic
 * graph with no dangling references. Pure: no DB, network, or clock. Throws a
 * descriptive error so a broken map fails loudly at content-load/test time,
 * never silently for a learner.
 */

export type CapabilityGraphInput = readonly Pick<Capability, "id" | "prerequisites">[];

/** Thrown when a competency map's prerequisite graph is invalid. */
export class InvalidCompetencyMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCompetencyMapError";
  }
}

/**
 * Validates that `capabilities` form a DAG:
 * - every prerequisite references an existing capability (no dangling refs);
 * - no capability depends on itself;
 * - no cycles of any length.
 *
 * @throws InvalidCompetencyMapError describing the first problem found.
 */
export function assertValidPrerequisiteDag(
  capabilities: CapabilityGraphInput,
): void {
  const ids = new Set<string>();
  for (const capability of capabilities) {
    if (ids.has(capability.id)) {
      throw new InvalidCompetencyMapError(
        `Duplicate capability id: "${capability.id}"`,
      );
    }
    ids.add(capability.id);
  }

  // Dangling references + self-dependency.
  for (const capability of capabilities) {
    for (const prerequisite of capability.prerequisites) {
      if (prerequisite === capability.id) {
        throw new InvalidCompetencyMapError(
          `Capability "${capability.id}" depends on itself`,
        );
      }
      if (!ids.has(prerequisite)) {
        throw new InvalidCompetencyMapError(
          `Capability "${capability.id}" has a dangling prerequisite "${prerequisite}"`,
        );
      }
    }
  }

  // Cycle detection via depth-first search with a recursion stack.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of ids) color.set(id, WHITE);

  const prerequisitesById = new Map<string, readonly string[]>();
  for (const capability of capabilities) {
    prerequisitesById.set(capability.id, capability.prerequisites);
  }

  const stack: string[] = [];

  function visit(id: string): void {
    color.set(id, GRAY);
    stack.push(id);
    for (const prerequisite of prerequisitesById.get(id) ?? []) {
      const state = color.get(prerequisite);
      if (state === GRAY) {
        // Found a back-edge: reconstruct the cycle for a clear message.
        const start = stack.indexOf(prerequisite);
        const cyclePath = stack.slice(start).concat(prerequisite).join(" -> ");
        throw new InvalidCompetencyMapError(
          `Prerequisite cycle detected: ${cyclePath}`,
        );
      }
      if (state === WHITE) {
        visit(prerequisite);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  }

  for (const id of ids) {
    if (color.get(id) === WHITE) {
      visit(id);
    }
  }
}

/**
 * Boolean variant of {@link assertValidPrerequisiteDag}. Returns `true` when
 * the graph is a valid DAG, `false` otherwise. Pure.
 */
export function isValidPrerequisiteDag(
  capabilities: CapabilityGraphInput,
): boolean {
  try {
    assertValidPrerequisiteDag(capabilities);
    return true;
  } catch (error) {
    if (error instanceof InvalidCompetencyMapError) {
      return false;
    }
    throw error;
  }
}
