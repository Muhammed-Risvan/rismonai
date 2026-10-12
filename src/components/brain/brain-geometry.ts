/**
 * Pure, deterministic brain point-cloud generator.
 *
 * - Seeded PRNG only — no Math.random, no DOM, no clock.
 * - ~680 points shaped as two hemispheres with a central gap and a folded
 *   (sulci/gyri style) surface, plus nearest-neighbour connections so the
 *   scene reads as a neural network.
 * - Returns typed arrays only; callers can feed them straight into three.js
 *   BufferAttributes without further allocation.
 */

export type BrainGeometry = {
  /** xyz triples, one per node. Length = nodeCount * 3. */
  positions: Float32Array;
  /** xyz triples, two consecutive points per edge. Length = edgeCount * 6. */
  linePositions: Float32Array;
  nodeCount: number;
  edgeCount: number;
  /** Indices of the few nodes that softly pulse in the scene. */
  pulseIndices: Uint16Array;
  /** Phase offset (radians) per pulsing node. */
  pulsePhases: Float32Array;
};

/** Kept within the 600–800 range required for the hero visual. */
export const BRAIN_NODE_COUNT = 680;
export const BRAIN_PULSE_NODE_COUNT = 10;

/** Ellipsoid semi-axes (x = lateral, y = vertical, z = front–back). */
const AX = 0.62;
const AY = 0.55;
const AZ = 0.86;
/** Half-width of the central gap between the hemispheres. */
const GAP_HALF = 0.05;
/** Max world-space distance for a nearest-neighbour connection. */
const MAX_LINK_DISTANCE = 0.17;
/** Surface fold amplitude as a fraction of the radius. */
const FOLD_AMPLITUDE = 0.06;
const FOLD_WAVE_COUNT = 6;

/** Deterministic 32-bit PRNG (mulberry32). Returns [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample built from the seeded PRNG (Box–Muller). */
function gaussian(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type Wave = {
  dx: number;
  dy: number;
  dz: number;
  freq: number;
  phase: number;
};

function buildFoldWaves(rng: () => number): Wave[] {
  const waves: Wave[] = [];
  for (let k = 0; k < FOLD_WAVE_COUNT; k++) {
    let dx = gaussian(rng);
    let dy = gaussian(rng);
    let dz = gaussian(rng);
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    waves.push({
      dx,
      dy,
      dz,
      freq: 3 + rng() * 4,
      phase: rng() * Math.PI * 2,
    });
  }
  return waves;
}

/** Roughly in [-1, 1]; displaces the surface to fake cortical folds. */
function fold(x: number, y: number, z: number, waves: readonly Wave[]): number {
  let sum = 0;
  for (const wave of waves) {
    sum += Math.sin(
      wave.freq * (wave.dx * x + wave.dy * y + wave.dz * z) + wave.phase,
    );
  }
  return (2 * sum) / waves.length;
}

export function generateBrainGeometry(seed = 1337): BrainGeometry {
  const rng = mulberry32(seed);
  const waves = buildFoldWaves(rng);

  const positions = new Float32Array(BRAIN_NODE_COUNT * 3);
  let written = 0;

  while (written < BRAIN_NODE_COUNT) {
    // Uniform direction on the sphere via gaussian samples.
    const dx = gaussian(rng);
    const dy = gaussian(rng);
    const dz = gaussian(rng);
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len === 0) continue;
    const nx = dx / len;
    const ny = dy / len;
    const nz = dz / len;

    const r = 1 + FOLD_AMPLITUDE * fold(nx, ny, nz, waves);
    const pz = nz * r * AZ;
    let px = nx * r * AX;
    let py = ny * r * AY;

    // Taper toward the front (+z) so the outline reads as a brain.
    if (pz > 0) {
      const taper = 1 - 0.15 * (pz / AZ) * (pz / AZ);
      px *= taper;
      py *= taper;
    }

    // Slightly flattened underside.
    const floorY = -0.42 * AY;
    if (py < floorY) py = floorY + (py - floorY) * 0.35;

    // Central gap between the two hemispheres.
    if (Math.abs(px) < GAP_HALF) continue;

    const offset = written * 3;
    positions[offset] = px;
    positions[offset + 1] = py;
    positions[offset + 2] = pz;
    written++;
  }

  // Nearest-neighbour connections (deterministic: ascending indices, ties
  // resolve to the lower index). Every node links to its nearest neighbour;
  // every second node also links to its second-nearest for a denser mesh.
  const edges: number[] = [];
  const seen = new Set<number>();
  const maxSq = MAX_LINK_DISTANCE * MAX_LINK_DISTANCE;

  function addEdge(i: number, j: number): void {
    const key = i < j ? i * BRAIN_NODE_COUNT + j : j * BRAIN_NODE_COUNT + i;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(i < j ? i : j, i < j ? j : i);
  }

  for (let i = 0; i < BRAIN_NODE_COUNT; i++) {
    const ix = positions[i * 3];
    const iy = positions[i * 3 + 1];
    const iz = positions[i * 3 + 2];
    let nearest = -1;
    let nearestSq = maxSq;
    let second = -1;
    let secondSq = maxSq;

    for (let j = 0; j < BRAIN_NODE_COUNT; j++) {
      if (j === i) continue;
      const ex = positions[j * 3] - ix;
      const ey = positions[j * 3 + 1] - iy;
      const ez = positions[j * 3 + 2] - iz;
      const dSq = ex * ex + ey * ey + ez * ez;
      if (dSq < nearestSq) {
        second = nearest;
        secondSq = nearestSq;
        nearest = j;
        nearestSq = dSq;
      } else if (dSq < secondSq) {
        second = j;
        secondSq = dSq;
      }
    }

    if (nearest !== -1) addEdge(i, nearest);
    if (i % 2 === 0 && second !== -1) addEdge(i, second);
  }

  const edgeCount = edges.length / 2;
  const linePositions = new Float32Array(edgeCount * 6);
  for (let e = 0; e < edgeCount; e++) {
    const a = edges[e * 2];
    const b = edges[e * 2 + 1];
    const target = e * 6;
    linePositions[target] = positions[a * 3];
    linePositions[target + 1] = positions[a * 3 + 1];
    linePositions[target + 2] = positions[a * 3 + 2];
    linePositions[target + 3] = positions[b * 3];
    linePositions[target + 4] = positions[b * 3 + 1];
    linePositions[target + 5] = positions[b * 3 + 2];
  }

  // A few evenly spread nodes pulse softly in the scene (deterministic).
  const pulseIndices = new Uint16Array(BRAIN_PULSE_NODE_COUNT);
  const pulsePhases = new Float32Array(BRAIN_PULSE_NODE_COUNT);
  for (let k = 0; k < BRAIN_PULSE_NODE_COUNT; k++) {
    pulseIndices[k] = Math.floor(
      ((k + 0.5) * BRAIN_NODE_COUNT) / BRAIN_PULSE_NODE_COUNT,
    );
    pulsePhases[k] = (2 * Math.PI * k) / BRAIN_PULSE_NODE_COUNT;
  }

  return {
    positions,
    linePositions,
    nodeCount: BRAIN_NODE_COUNT,
    edgeCount,
    pulseIndices,
    pulsePhases,
  };
}
