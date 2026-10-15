import { describe, expect, it } from "vitest";
import { buildDiagnosticBank } from "@/core/diagnostic/bank";
import {
  initialLevelFor,
  isCapabilityCovered,
  isRunComplete,
  pendingConditionalItem,
} from "@/core/diagnostic/coverage";
import { MASTERY_STATES } from "@/core/mastery";
import { cloudSecurityEngineerMap } from "@content";

/**
 * M3 coverage tests (pure, fixed sequences).
 *
 * Separate predicates: covered vs complete. Incorrect answers satisfy coverage
 * without proving competence. A pending remedial probe blocks completion.
 * Levels come from the real mastery engine under a `demonstrated` ceiling, so
 * they are triage — never `mastered`.
 */

const NOW = new Date("2026-03-01T00:00:00.000Z");

const S1 = "exercise-shared-responsibility-mcq";
const S2 = "exercise-shared-boundary-check";
const I1 = "exercise-identity-allowlist-assessment";
const N1 = "exercise-network-exposure-assessment";
const L1 = "exercise-detection-signal-assessment";

describe("coverage predicates", () => {
  it("incorrect answers satisfy capability coverage without proving competence", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const answers = new Map([[S1, false]]);
    expect(
      isCapabilityCovered(
        bank.entries,
        answers,
        "cloud-shared-responsibility",
      ),
    ).toBe(true);
    // ...but the level mapping records no demonstration.
    expect(initialLevelFor([false], NOW)).toBe("practising");
  });

  it("a pending conditional probe blocks completion", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const answers = new Map([[S1, false]]);
    expect(pendingConditionalItem(bank.entries, answers)).toBe(S2);
    expect(
      isRunComplete(bank.entries, bank.requiredCapabilityIds, answers),
    ).toBe(false);
  });

  it("excused conditionals do not block completion (experienced sequence)", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const answers = new Map([
      [S1, true],
      [I1, true],
      [N1, true],
      [L1, true],
    ]);
    expect(pendingConditionalItem(bank.entries, answers)).toBeNull();
    expect(
      isRunComplete(bank.entries, bank.requiredCapabilityIds, answers),
    ).toBe(true);
  });

  it("weak-start sequence completes only after the remedial probe", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const withoutRemedial = new Map([
      [S1, false],
      [I1, true],
      [N1, true],
      [L1, true],
    ]);
    expect(
      isRunComplete(bank.entries, bank.requiredCapabilityIds, withoutRemedial),
    ).toBe(false);
    const withRemedial = new Map([
      [S1, false],
      [S2, true],
      [I1, true],
      [N1, true],
      [L1, true],
    ]);
    expect(
      isRunComplete(bank.entries, bank.requiredCapabilityIds, withRemedial),
    ).toBe(true);
  });

  it("maps fixed sequences to per-capability triage levels (never mastered)", () => {
    const beginner = {
      "cloud-shared-responsibility": initialLevelFor([false, true], NOW),
      "identity-and-access-basics": initialLevelFor([false], NOW),
      "network-security-basics": initialLevelFor([false], NOW),
      "logging-and-monitoring": initialLevelFor([false], NOW),
    };
    expect(beginner).toEqual({
      "cloud-shared-responsibility": "demonstrated",
      "identity-and-access-basics": "practising",
      "network-security-basics": "practising",
      "logging-and-monitoring": "practising",
    });

    const experienced = {
      "cloud-shared-responsibility": initialLevelFor([true], NOW),
      "identity-and-access-basics": initialLevelFor([true], NOW),
      "network-security-basics": initialLevelFor([true], NOW),
      "logging-and-monitoring": initialLevelFor([true], NOW),
    };
    expect(experienced).toEqual({
      "cloud-shared-responsibility": "demonstrated",
      "identity-and-access-basics": "demonstrated",
      "network-security-basics": "demonstrated",
      "logging-and-monitoring": "demonstrated",
    });
    expect(beginner).not.toEqual(experienced);

    // The mapping can never produce `mastered`.
    for (const results of [[true], [false], [true, false], []]) {
      const level = initialLevelFor(results, NOW);
      expect(level).not.toBe("mastered");
      expect(MASTERY_STATES).toContain(level);
    }
  });
});
