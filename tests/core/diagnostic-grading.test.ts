import { describe, expect, it } from "vitest";
import {
  gradeDiagnosticAnswer,
  normalizeDiagnosticResponse,
} from "@/core/diagnostic/grading";

/**
 * M3 diagnostic grading tests (pure).
 *
 * Fixed rule: trim + collapse whitespace + lowercase exact match against the
 * snapshot's accepted answers. Empty responses are incorrect, never errors.
 */

describe("normalizeDiagnosticResponse", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeDiagnosticResponse("  Sign-IN   Log ")).toBe(
      "sign-in log",
    );
  });
});

describe("gradeDiagnosticAnswer", () => {
  it("accepts exact, case-insensitive, and whitespace-tolerant matches", () => {
    expect(gradeDiagnosticAnswer("you", ["you"])).toBe(true);
    expect(gradeDiagnosticAnswer("YOU", ["you"])).toBe(true);
    expect(gradeDiagnosticAnswer("  sign-in   log ", ["sign-in log"])).toBe(
      true,
    );
  });

  it("accepts any of several accepted answers", () => {
    expect(gradeDiagnosticAnswer("read-only", ["admin", "read-only"])).toBe(
      true,
    );
  });

  it("rejects wrong answers and empty responses", () => {
    expect(gradeDiagnosticAnswer("provider", ["you"])).toBe(false);
    expect(gradeDiagnosticAnswer("", ["you"])).toBe(false);
    expect(gradeDiagnosticAnswer("   ", ["you"])).toBe(false);
  });
});
