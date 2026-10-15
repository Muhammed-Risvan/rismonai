import { describe, expect, it } from "vitest";
import { buildDiagnosticBank } from "@/core/diagnostic/bank";
import { nextDiagnosticItem } from "@/core/diagnostic/selection";
import { cloudSecurityEngineerMap } from "@content";

/**
 * M3 deterministic selection tests (pure, fixed answer sequences).
 *
 * Proves the v3 trace: S1✓ skips the remedial and finishes in 4, S1✗
 * branches to the genuinely different next item S2, and resume rebuilds
 * the identical next item from persisted answers alone.
 */

const S1 = "exercise-shared-responsibility-mcq";
const S2 = "exercise-shared-boundary-check";
const I1 = "exercise-identity-allowlist-assessment";
const N1 = "exercise-network-exposure-assessment";
const L1 = "exercise-detection-signal-assessment";

function entries() {
  return buildDiagnosticBank(cloudSecurityEngineerMap).entries;
}

describe("nextDiagnosticItem", () => {
  it("starts with the topological-first probe S1", () => {
    expect(nextDiagnosticItem(entries(), new Map())).toBe(S1);
  });

  it("branches: S1 incorrect yields S2, S1 correct yields I1 (different next items)", () => {
    const afterWrong = nextDiagnosticItem(entries(), new Map([[S1, false]]));
    const afterRight = nextDiagnosticItem(entries(), new Map([[S1, true]]));
    expect(afterWrong).toBe(S2);
    expect(afterRight).toBe(I1);
    expect(afterWrong).not.toBe(afterRight);
  });

  it("strong-start path finishes in 4 submissions, weak-start path in 5", () => {
    const strong = new Map([
      [S1, true],
      [I1, true],
      [N1, true],
      [L1, true],
    ]);
    expect(nextDiagnosticItem(entries(), strong)).toBeNull();

    const weak = new Map([
      [S1, false],
      [S2, true],
      [I1, false],
      [N1, false],
      [L1, false],
    ]);
    expect(nextDiagnosticItem(entries(), weak)).toBeNull();
  });

  it("does not surface the conditional probe before its trigger is answered", () => {
    // No answers at all: S2 is never first even though it sits at position 1.
    expect(nextDiagnosticItem(entries(), new Map())).toBe(S1);
  });

  it("resume recomputes the identical next item from stored answers", () => {
    const bankEntries = entries();
    const answers = new Map([
      [S1, false],
      [S2, true],
    ]);
    const first = nextDiagnosticItem(bankEntries, answers);
    // Simulate a refresh: rebuild the answers map from persisted rows.
    const rebuilt = new Map([...answers.entries()]);
    expect(nextDiagnosticItem(bankEntries, rebuilt)).toBe(first);
    expect(first).toBe(I1);
  });

  it("is deterministic across repeated calls", () => {
    const bankEntries = entries();
    const answers = new Map([[S1, false]]);
    expect(nextDiagnosticItem(bankEntries, answers)).toBe(
      nextDiagnosticItem(bankEntries, answers),
    );
  });
});
