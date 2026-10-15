import type { CompetencyMap } from "../content/ambition";
import { InvalidCompetencyMapError } from "../content/dag";

/**
 * M3 diagnostic bank builder (pure).
 *
 * Derives the deterministic, ordered diagnostic item bank from a validated
 * competency map. No DB, network, or clock.
 *
 * Rules:
 * - Only `kind: "assessment"` exercises are diagnostic-eligible. Guided
 *   `practice` items (hints allowed) can never be diagnostic evidence, so
 *   they are excluded here by construction (spec.md §8).
 * - Capabilities are ordered topologically (prerequisites first). Ties break
 *   by seed file order, then slug — fully deterministic.
 * - Within a capability, items keep seed file order.
 * - An exercise may declare `reprobeOf: <itemId>` (content-owned). Such a
 *   remedial probe is asked only when its trigger was answered incorrectly,
 *   and is excused when the trigger was answered correctly. The trigger
 *   relationship is validated by `content/references.ts`, so a dangling,
 *   self-referential or forward-pointing `reprobeOf` fails at content-load
 *   time rather than degrading silently at run time.
 * - The primary capability of an exercise is `capabilityIds[0]` (seed items
 *   each name exactly one capability).
 */

export interface DiagnosticBankEntry {
  readonly itemId: string;
  readonly capabilityId: string;
  readonly position: number;
  /**
   * Trigger item id that must have been answered incorrectly for this item
   * to be asked; `null` means the item is always asked in order.
   */
  readonly conditionalOn: string | null;
}

export interface DiagnosticBank {
  readonly itemIds: readonly string[];
  readonly requiredCapabilityIds: readonly string[];
  readonly entries: readonly DiagnosticBankEntry[];
}

/** Stable topological order of capability ids (Kahn's algorithm). */
function topologicalCapabilityOrder(
  capabilities: CompetencyMap["capabilities"],
): string[] {
  const fileOrder = new Map<string, number>();
  capabilities.forEach((capability, index) =>
    fileOrder.set(capability.id, index),
  );
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const capability of capabilities) {
    indegree.set(capability.id, 0);
    dependents.set(capability.id, []);
  }
  for (const capability of capabilities) {
    for (const prerequisite of capability.prerequisites) {
      if (!indegree.has(prerequisite)) {
        throw new InvalidCompetencyMapError(
          `Capability "${capability.id}" has a dangling prerequisite "${prerequisite}"`,
        );
      }
      indegree.set(capability.id, (indegree.get(capability.id) ?? 0) + 1);
      dependents.get(prerequisite)?.push(capability.id);
    }
  }

  const byFileOrder = (a: string, b: string): number => {
    const order = (fileOrder.get(a) ?? 0) - (fileOrder.get(b) ?? 0);
    return order !== 0 ? order : a.localeCompare(b);
  };
  const queue = [...indegree.keys()]
    .filter((id) => indegree.get(id) === 0)
    .sort(byFileOrder);
  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    sorted.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      indegree.set(dependent, (indegree.get(dependent) ?? 1) - 1);
      if (indegree.get(dependent) === 0) {
        queue.push(dependent);
        queue.sort(byFileOrder);
      }
    }
  }
  if (sorted.length !== capabilities.length) {
    throw new InvalidCompetencyMapError(
      "Prerequisite cycle detected while ordering capabilities",
    );
  }
  return sorted;
}

/**
 * Builds the diagnostic bank for a competency map. The caller must pass a
 * map that already passed `validateCompetencyMap` (shape + DAG +
 * references); this function additionally throws `InvalidCompetencyMapError`
 * on structural problems it cannot answer safely.
 */
export function buildDiagnosticBank(map: CompetencyMap): DiagnosticBank {
  const capabilityOrder = topologicalCapabilityOrder(map.capabilities);

  const entries: DiagnosticBankEntry[] = [];
  for (const capabilityId of capabilityOrder) {
    const assessments = map.exercises.filter(
      (exercise) =>
        exercise.kind === "assessment" &&
        exercise.capabilityIds[0] === capabilityId,
    );
    for (const exercise of assessments) {
      entries.push({
        itemId: exercise.id,
        capabilityId,
        position: entries.length,
        conditionalOn: null,
      });
    }
  }

  // Read the remedial-probe trigger from the content itself. `references.ts`
  // has already proved every `reprobeOf` resolves to a real, earlier exercise,
  // so anything unexpected here degrades to "always ask" rather than throwing.
  const positionsByItem = new Map(entries.map((e) => [e.itemId, e.position]));
  const resolved: DiagnosticBankEntry[] = entries.map((entry) => {
    const exercise = map.exercises.find((e) => e.id === entry.itemId);
    const trigger = exercise?.reprobeOf;
    if (trigger === null || trigger === undefined) {
      return entry;
    }
    const triggerPosition = positionsByItem.get(trigger);
    if (
      triggerPosition === undefined ||
      triggerPosition >= entry.position ||
      trigger === entry.itemId
    ) {
      return entry;
    }
    return { ...entry, conditionalOn: trigger };
  });

  const requiredCapabilityIds = capabilityOrder.filter((capabilityId) =>
    resolved.some((entry) => entry.capabilityId === capabilityId),
  );

  return {
    itemIds: resolved.map((entry) => entry.itemId),
    requiredCapabilityIds,
    entries: resolved,
  };
}
