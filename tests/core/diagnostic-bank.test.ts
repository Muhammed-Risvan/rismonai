import { describe, expect, it } from "vitest";
import { buildDiagnosticBank } from "@/core/diagnostic/bank";
import { cloudSecurityEngineerMap } from "@content";

/**
 * M3 diagnostic bank tests (pure).
 *
 * Fixed expectations against the real seed map: topological order
 * (prerequisites first), assessment-only eligibility (the practice item is
 * excluded), every capability covered, one conditional remedial probe.
 */

describe("buildDiagnosticBank", () => {
  it("builds the expected ordered bank from the seed map", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    expect(bank.itemIds).toEqual([
      "exercise-shared-responsibility-mcq",
      "exercise-shared-boundary-check",
      "exercise-identity-allowlist-assessment",
      "exercise-network-exposure-assessment",
      "exercise-detection-signal-assessment",
    ]);
    expect(bank.requiredCapabilityIds).toEqual([
      "cloud-shared-responsibility",
      "identity-and-access-basics",
      "network-security-basics",
      "logging-and-monitoring",
    ]);
    // Practice items are never diagnostic-eligible.
    expect(bank.itemIds).not.toContain("exercise-least-privilege-choice");
    // Only the remedial re-probe is conditional.
    expect(
      bank.entries.find(
        (entry) => entry.itemId === "exercise-shared-boundary-check",
      )?.conditionalOn,
    ).toBe("exercise-shared-responsibility-mcq");
    for (const entry of bank.entries) {
      if (entry.itemId !== "exercise-shared-boundary-check") {
        expect(entry.conditionalOn).toBeNull();
      }
    }
    // Positions are dense and ordered.
    expect(bank.entries.map((entry) => entry.position)).toEqual([0, 1, 2, 3, 4]);
  });
});
