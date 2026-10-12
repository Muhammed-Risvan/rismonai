"use client";

import { Canvas } from "@react-three/fiber";
import dynamic from "next/dynamic";
import {
  Component,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// three.js loads only on the client, only on the route that renders this.
const BrainScene = dynamic(() => import("./brain-scene"), { ssr: false });

type ThemeColors = { node: string; line: string; pulse: string };

function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  return {
    node: styles.getPropertyValue("--brain-node").trim() || "#0a0a0a",
    line: styles.getPropertyValue("--brain-line").trim() || "#a1a1aa",
    pulse: styles.getPropertyValue("--brain-pulse").trim() || "#0068d6",
  };
}

function isWebGlAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ?? canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

/** Static inline SVG shown when WebGL is unavailable or the scene throws. */
function BrainFallback() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="h-full w-full text-muted"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" fill="none" strokeWidth="1.5" opacity="0.6">
        <path d="M200 58 C 152 38 104 54 96 94 C 62 106 56 152 80 176 C 72 216 112 246 150 236 C 166 256 190 250 200 236" />
        <path d="M200 58 C 248 38 296 54 304 94 C 338 106 344 152 320 176 C 328 216 288 246 250 236 C 234 256 210 250 200 236" />
        <path d="M148 102 L 176 132 L 146 162 L 172 196" opacity="0.7" />
        <path d="M252 102 L 224 132 L 254 162 L 228 196" opacity="0.7" />
        <path d="M118 124 L 148 148 M282 124 L 252 148" opacity="0.7" />
        <path d="M126 190 L 154 178 M274 190 L 246 178" opacity="0.7" />
      </g>
      <g fill="currentColor" opacity="0.8">
        <circle cx="148" cy="102" r="3.5" />
        <circle cx="176" cy="132" r="3.5" />
        <circle cx="146" cy="162" r="3.5" />
        <circle cx="172" cy="196" r="3.5" />
        <circle cx="252" cy="102" r="3.5" />
        <circle cx="224" cy="132" r="3.5" />
        <circle cx="254" cy="162" r="3.5" />
        <circle cx="228" cy="196" r="3.5" />
        <circle cx="118" cy="124" r="3" />
        <circle cx="282" cy="124" r="3" />
        <circle cx="200" cy="72" r="3" />
        <circle cx="200" cy="228" r="3" />
      </g>
    </svg>
  );
}

/** Catches render-time throws from the Canvas subtree → SVG fallback. */
class BrainErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Decorative visual: fall back silently, never surface to the user.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Home-page hero wrapper. Decorative (aria-hidden): pauses when offscreen or
 * when the tab is hidden, renders one static frame under prefers-reduced-motion,
 * and falls back to a static SVG without WebGL.
 */
export function BrainVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Mount-time environment reads, computed once as initial state (no effects):
  // WebGL support, reduced-motion preference, and the theme's brain colours.
  const [supported] = useState<boolean>(() => isWebGlAvailable());
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [colors, setColors] = useState<ThemeColors | null>(() =>
    typeof window === "undefined" ? null : readThemeColors(),
  );
  const [inView, setInView] = useState(
    () => typeof window === "undefined" || !("IntersectionObserver" in window),
  );
  // Rendering only proceeds on the client while the tab is visible; the
  // initial value is read lazily so no effect is needed to set it.
  const [pageVisible, setPageVisible] = useState<boolean>(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  // Follow reduced-motion changes after mount.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Pause rendering while the tab is hidden (subscription only — the initial
  // value above is already correct, so nothing is set synchronously here).
  useEffect(() => {
    const onVisibility = () =>
      setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Pause rendering while the visual is offscreen. When there is no
  // IntersectionObserver the lazy initial state above is already `true`.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "64px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Follow OS colour-scheme changes (initial colours come from lazy state).
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setColors(readThemeColors());
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const frameloop: "always" | "demand" | "never" = !inView || !pageVisible
    ? "never"
    : reducedMotion
      ? "demand"
      : "always";

  return (
    <div ref={containerRef} className="h-full w-full" aria-hidden="true">
      {!supported ? (
        <BrainFallback />
      ) : (
        colors !== null && (
          <BrainErrorBoundary fallback={<BrainFallback />}>
            <Canvas
              frameloop={frameloop}
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 2.4], fov: 40 }}
              gl={{ antialias: true, alpha: true }}
            >
              <BrainScene
                nodeColor={colors.node}
                lineColor={colors.line}
                pulseColor={colors.pulse}
                reducedMotion={reducedMotion}
              />
            </Canvas>
          </BrainErrorBoundary>
        )
      )}
    </div>
  );
}
