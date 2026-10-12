"use client";

import { invalidate, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { generateBrainGeometry } from "./brain-geometry";

/** Slow, deliberate turn — reads as "alive" without being busy. */
const ROTATION_SPEED = 0.12; // rad/s
const PULSE_SPEED = 1.6; // rad/s
const NODE_SIZE = 0.028;
const LINE_OPACITY = 0.4;

export type BrainSceneProps = {
  /** Hex colours read from the active theme's CSS variables. */
  nodeColor: string;
  lineColor: string;
  pulseColor: string;
  /** One static frame: no rotation, no pulsing. */
  reducedMotion: boolean;
};

/** sRGB hex → linear RGB triple (THREE.Color converts on set). */
function toLinearTriple(hex: string): [number, number, number] {
  const color = new THREE.Color(hex);
  return [color.r, color.g, color.b];
}

/**
 * One Points object + one LineSegments object (two draw calls total).
 * All buffers are created once; the frame loop mutates existing arrays in
 * place and allocates nothing.
 */
export default function BrainScene({
  nodeColor,
  lineColor,
  pulseColor,
  reducedMotion,
}: BrainSceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Pure + deterministic; generated once per mount.
  const geometry = useMemo(() => generateBrainGeometry(), []);

  const palette = useMemo(
    () => ({
      base: toLinearTriple(nodeColor),
      pulse: toLinearTriple(pulseColor),
    }),
    [nodeColor, pulseColor],
  );

  const pointsGeometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute(
      "position",
      new THREE.BufferAttribute(geometry.positions, 3),
    );
    const colors = new Float32Array(geometry.nodeCount * 3);
    for (let i = 0; i < geometry.nodeCount; i++) {
      colors[i * 3] = palette.base[0];
      colors[i * 3 + 1] = palette.base[1];
      colors[i * 3 + 2] = palette.base[2];
    }
    buffer.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return buffer;
  }, [geometry, palette]);

  const linesGeometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute(
      "position",
      new THREE.BufferAttribute(geometry.linePositions, 3),
    );
    return buffer;
  }, [geometry]);

  // Free GPU resources when a geometry is replaced (e.g. theme change).
  useEffect(() => () => pointsGeometry.dispose(), [pointsGeometry]);
  useEffect(() => () => linesGeometry.dispose(), [linesGeometry]);

  // Draw a frame in "demand" mode (reduced motion / after a theme change).
  useEffect(() => {
    invalidate();
  }, [pointsGeometry, reducedMotion]);

  useFrame((state, delta) => {
    if (reducedMotion) return;

    const group = groupRef.current;
    if (group) {
      group.rotation.y += Math.min(delta, 0.1) * ROTATION_SPEED;
    }

    // Softly pulse a few nodes — writes into the existing colour buffer.
    const colorAttribute = pointsGeometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const array = colorAttribute.array as Float32Array;
    const time = state.clock.elapsedTime;
    const { base, pulse } = palette;
    for (let k = 0; k < geometry.pulseIndices.length; k++) {
      const index = geometry.pulseIndices[k];
      const phase = geometry.pulsePhases[k];
      const amount = 0.5 + 0.5 * Math.sin(time * PULSE_SPEED + phase);
      const offset = index * 3;
      array[offset] = base[0] + (pulse[0] - base[0]) * amount;
      array[offset + 1] = base[1] + (pulse[1] - base[1]) * amount;
      array[offset + 2] = base[2] + (pulse[2] - base[2]) * amount;
    }
    colorAttribute.needsUpdate = true;
  });

  return (
    <group ref={groupRef} rotation={[0.18, -0.4, 0]}>
      <points geometry={pointsGeometry}>
        <pointsMaterial
          size={NODE_SIZE}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
        />
      </points>
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial
          color={lineColor}
          transparent
          opacity={LINE_OPACITY}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
