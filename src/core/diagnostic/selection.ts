import type { DiagnosticBankEntry } from "./bank";

/**
 * M3 deterministic item selection (pure).
 *
 * ONE algorithm serves first-item, next-item, and resume: the next item is a
 * pure function of the ordered snapshot entries plus the answered map, so
 * the same stored answers always reconstruct the same next item. No clock,
 * no randomness, no AI.
 *
 * Rules (M3 v3):
 * - Scan snapshot entries in position order; the first unanswered,
 *   non-excused entry wins.
 * - A conditional entry is eligible only once its trigger is answered:
 *   trigger incorrect → the entry is the pending remedial probe (returned);
 *   trigger correct → the entry is excused (skipped).
 * - Prerequisites need no special case: the bank is built in topological
 *   order, so every item's prerequisites precede it; a prerequisite with
 *   zero bank items is vacuously satisfied.
 */

/** Answers recorded so far in a run: item id → whether it was correct. */
export type DiagnosticAnswers = ReadonlyMap<string, boolean>;

/**
 * Returns the next item id to ask, or `null` when no eligible unanswered
 * item remains. Pure.
 */
export function nextDiagnosticItem(
  entries: readonly DiagnosticBankEntry[],
  answers: DiagnosticAnswers,
): string | null {
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  for (const entry of ordered) {
    if (answers.has(entry.itemId)) {
      continue;
    }
    if (entry.conditionalOn !== null) {
      if (!answers.has(entry.conditionalOn)) {
        // Trigger not answered yet: not eligible (preserves order).
        continue;
      }
      if (answers.get(entry.conditionalOn) === true) {
        // Trigger demonstrated: remedial probe excused.
        continue;
      }
      return entry.itemId;
    }
    return entry.itemId;
  }
  return null;
}
