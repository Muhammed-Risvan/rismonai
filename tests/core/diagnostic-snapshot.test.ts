import { describe, expect, it } from "vitest";
import { buildDiagnosticBank } from "@/core/diagnostic/bank";
import {
  buildItemsSnapshot,
  diagnosticSnapshotSchema,
  MAX_SNAPSHOT_ITEMS,
} from "@/core/diagnostic/snapshot";
import { cloudSecurityEngineerMap } from "@content";

/**
 * M3 immutable snapshot tests (pure).
 *
 * The per-run JSONB snapshot freezes prompts, capability bindings, accepted
 * answers, order, and conditional metadata. Validated at creation AND on
 * every load for grading/resume. Accepted answers never leave the server
 * (DTO stripping is asserted in the service/UI layer tests).
 */

describe("diagnosticSnapshotSchema", () => {
  it("accepts the snapshot built from the real bank", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const snapshot = buildItemsSnapshot(bank, cloudSecurityEngineerMap.exercises);
    const parsed = diagnosticSnapshotSchema.safeParse(snapshot);
    expect(parsed.success).toBe(true);
    expect(snapshot).toHaveLength(5);
    expect(snapshot.map((item) => item.itemId)).toEqual([...bank.itemIds]);
  });

  it("rejects duplicate item ids", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const snapshot = buildItemsSnapshot(bank, cloudSecurityEngineerMap.exercises);
    const doubled = [...snapshot, { ...snapshot[0]!, position: snapshot.length }];
    expect(diagnosticSnapshotSchema.safeParse(doubled).success).toBe(false);
  });

  it("rejects position mismatches", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const snapshot = buildItemsSnapshot(bank, cloudSecurityEngineerMap.exercises);
    const shifted = snapshot.map((item) => ({ ...item, position: 0 }));
    expect(diagnosticSnapshotSchema.safeParse(shifted).success).toBe(false);
  });

  it("rejects unknown or misordered conditional triggers", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const snapshot = buildItemsSnapshot(bank, cloudSecurityEngineerMap.exercises);
    const unknownTrigger = snapshot.map((item) =>
      item.itemId === "exercise-shared-boundary-check"
        ? { ...item, conditionalOn: "no-such-item" }
        : item,
    );
    expect(diagnosticSnapshotSchema.safeParse(unknownTrigger).success).toBe(
      false,
    );
    // Trigger placed after the conditional is rejected.
    const reversed = [...snapshot].reverse().map((item, index) => ({
      ...item,
      position: index,
    }));
    expect(diagnosticSnapshotSchema.safeParse(reversed).success).toBe(false);
  });

  it("rejects empty answers, oversized banks, and unknown keys", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    const snapshot = buildItemsSnapshot(bank, cloudSecurityEngineerMap.exercises);
    const emptied = snapshot.map((item) => ({ ...item, accepted: [] as string[] }));
    expect(diagnosticSnapshotSchema.safeParse(emptied).success).toBe(false);
    expect(diagnosticSnapshotSchema.safeParse([]).success).toBe(false);
    const oversized = Array.from(
      { length: MAX_SNAPSHOT_ITEMS + 1 },
      (_, index) => ({
        itemId: `item-${index}`,
        capabilityId: "some-cap",
        prompt: "Prompt?",
        accepted: ["yes"],
        position: index,
        conditionalOn: null,
      }),
    );
    expect(diagnosticSnapshotSchema.safeParse(oversized).success).toBe(false);
    const withExtra = snapshot.map((item) => ({ ...item, learnerId: "x" }));
    expect(diagnosticSnapshotSchema.safeParse(withExtra).success).toBe(false);
  });

  it("throws when the bank references an exercise missing from the map", () => {
    const bank = buildDiagnosticBank(cloudSecurityEngineerMap);
    expect(() => buildItemsSnapshot(bank, [])).toThrow(/no matching exercise/);
  });
});
