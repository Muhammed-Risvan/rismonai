import { describe, expect, it } from "vitest";
import { generateBrainGeometry } from "@/components/brain/brain-geometry";

function allFinite(array: Float32Array): boolean {
  for (let i = 0; i < array.length; i++) {
    if (!Number.isFinite(array[i])) return false;
  }
  return true;
}

function differsAt(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

describe("generateBrainGeometry", () => {
  it("produces 600–800 points with consistent buffers", () => {
    const geometry = generateBrainGeometry();

    expect(geometry.nodeCount).toBeGreaterThanOrEqual(600);
    expect(geometry.nodeCount).toBeLessThanOrEqual(800);
    expect(geometry.positions.length).toBe(geometry.nodeCount * 3);
    expect(geometry.linePositions.length).toBe(geometry.edgeCount * 6);
    expect(geometry.edgeCount).toBeGreaterThan(0);
    expect(geometry.pulseIndices.length).toBeGreaterThan(0);
    expect(geometry.pulseIndices.length).toBe(geometry.pulsePhases.length);
  });

  it("returns only finite values", () => {
    const geometry = generateBrainGeometry(42);
    expect(allFinite(geometry.positions)).toBe(true);
    expect(allFinite(geometry.linePositions)).toBe(true);
    expect(allFinite(geometry.pulsePhases)).toBe(true);
  });

  it("keeps a central gap between the two hemispheres", () => {
    const geometry = generateBrainGeometry();
    let onLeft = false;
    let onRight = false;
    for (let i = 0; i < geometry.nodeCount; i++) {
      const x = geometry.positions[i * 3];
      // GAP_HALF is 0.05; allow for float32 rounding.
      expect(Math.abs(x)).toBeGreaterThanOrEqual(0.049);
      if (x < 0) onLeft = true;
      if (x > 0) onRight = true;
    }
    expect(onLeft).toBe(true);
    expect(onRight).toBe(true);
  });

  it("gives identical output for the same seed", () => {
    const a = generateBrainGeometry(1337);
    const b = generateBrainGeometry(1337);

    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.linePositions)).toEqual(Array.from(b.linePositions));
    expect(Array.from(a.pulseIndices)).toEqual(Array.from(b.pulseIndices));
    expect(Array.from(a.pulsePhases)).toEqual(Array.from(b.pulsePhases));
    expect(a.edgeCount).toBe(b.edgeCount);
  });

  it("gives different output for a different seed", () => {
    const a = generateBrainGeometry(1);
    const b = generateBrainGeometry(2);

    expect(differsAt(a.positions, b.positions)).toBe(true);
  });
});
