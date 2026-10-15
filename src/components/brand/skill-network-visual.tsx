/**
 * Decorative hero illustration: a static skill network (nodes = skills,
 * edges = prerequisites).
 *
 * This is marketing artwork, not learner data. The dashboard's real skill
 * network is rendered from the learner's saved capability and mastery data;
 * it is deliberately NOT wired to this component (see `brief.md` §5.5).
 *
 * Pure Server Component: no "use client", no JavaScript, no WebGL, no
 * animation state — it is one inline SVG that renders in the static HTML.
 */
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [2, 4],
  [3, 5],
  [4, 5],
];

// Node positions on a 400x300 viewBox, authored by hand (no generator).
const NODES: ReadonlyArray<readonly [number, number]> = [
  [200, 46], // root: fundamentals
  [136, 116], // networking
  [264, 116], // linux
  [176, 186], // programming
  [248, 196], // security
  [200, 262], // cloud
];

// "Demonstrated" nodes are emphasised; the rest stay muted. This encodes the
// product idea (evidence unlocks dependents) without asserting any real
// learner's state.
const DEMONSTRATED = new Set([0, 1, 2]);

export function SkillNetworkVisual() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="h-full w-full"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="var(--network-line)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.75"
      >
        {EDGES.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={NODES[from][0]}
            y1={NODES[from][1]}
            x2={NODES[to][0]}
            y2={NODES[to][1]}
          />
        ))}
      </g>
      {NODES.map(([cx, cy], index) => (
        <circle
          key={cx + "-" + cy}
          cx={cx}
          cy={cy}
          r={DEMONSTRATED.has(index) ? 8 : 6}
          fill={DEMONSTRATED.has(index) ? "var(--network-node)" : "none"}
          stroke="var(--network-node)"
          strokeWidth="1.5"
          opacity={DEMONSTRATED.has(index) ? 0.9 : 0.5}
        />
      ))}
    </svg>
  );
}