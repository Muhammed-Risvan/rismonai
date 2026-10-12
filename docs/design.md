# Design system

Milestone 2A. Vercel-like, Tailwind only, driven by CSS variables in
`src/app/globals.css`. Light and dark come from `prefers-color-scheme` — there
is no theme toggle yet.

## Tokens

All colours are CSS custom properties on `:root` (light defaults), overridden
in a `@media (prefers-color-scheme: dark)` block. Tailwind reads them through
`@theme inline` (`bg-background`, `text-foreground`, `text-muted`,
`border-border`, `bg-surface`, `text-accent`, …), so no `dark:` variants are
needed for token colours.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#0a0a0a` | page background |
| `--foreground` | `#0a0a0a` | `#ededed` | primary text |
| `--muted` | `#52525b` (7.0:1 on white) | `#a1a1aa` (12:1 on `#0a0a0a`) | secondary text |
| `--border` | `#e4e4e7` | `#262626` | hairline borders |
| `--surface` | `#fafafa` | `#111111` | subtle panels/cards |
| `--accent` | `#0068d6` (5.3:1 on white) | `#3291ff` (6.3:1 on `#0a0a0a`) | one restrained accent, used sparingly (links, badges, focus) |
| `--ring` | `#0068d6` | `#3291ff` | focus rings |

Background decoration: `--grid-line` + `--glow` feed the `.bg-grid` (56px
hairline grid) and `.bg-radial-glow` (single radial glow behind the hero brain)
utilities. Used once on the home hero — not gradients everywhere.

## Fonts

Geist Sans for text, Geist Mono for small labels and code, both through
`next/font` (`Geist`, `Geist_Mono` in `src/app/layout.tsx`, variables
`--font-geist-sans` / `--font-geist-mono`). Headings use tight tracking
(`letter-spacing: -0.02em`, `text-wrap: balance`); body keeps generous spacing.

## Components (`src/components/ui`)

Plain React + Tailwind, no UI libraries:

- `Button` (`primary` solid, `secondary` outline) and `ButtonLink`
  (button-styled link; internal paths use `next/link`).
- `Badge` (`neutral`, `accent`) — "Private beta", "DRAFT, pending review".
- `Container` (gutter + `max-w-5xl`, `narrow` = `max-w-3xl` for text pages).
- `Section` (vertical rhythm: `py-16 md:py-24`).
- `SiteHeader` — text logo "Rismon", nav (Vision, Sign in, "Request access"
  button), mobile menu with plain React state (`aria-expanded`,
  `aria-controls`, closes on route change and Escape).
- `SiteFooter` — Vision, Privacy, Terms, Contact, "Private beta" badge,
  copyright with a cached build-time year.

Accessibility: skip-to-content link, semantic headings, visible `:focus-visible`
rings everywhere, keyboard-accessible controls, `prefers-reduced-motion`
respected globally in CSS. Accent/muted pairs above are WCAG AA.

## Brain visual (`src/components/brain`)

Performance rules — it must stay smooth on integrated graphics:

- Geometry (`brain-geometry.ts`) is pure and deterministic (seeded PRNG, no
  `Math.random`/DOM/clock): ~680 nodes in two hemispheres with a central gap
  and folded surface noise, plus nearest-neighbour `LineSegments` edges.
- Scene (`brain-scene.tsx`) is exactly two draw calls (one `Points`, one
  `LineSegments`), slow rotation, a few softly pulsing nodes, colours read from
  the active theme's CSS variables. Pixel ratio capped at 1.5. The frame loop
  mutates existing buffers in place — no per-frame allocation.
- The wrapper (`brain-visual.tsx`) loads the scene with `next/dynamic`
  (`ssr: false`) and renders it only on the home page, so three.js stays out of
  other routes' bundles. Rendering pauses when offscreen (`IntersectionObserver`)
  or the tab is hidden; `prefers-reduced-motion` renders one static frame; no
  WebGL (or a throw) shows a static inline SVG fallback. Decorative:
  `aria-hidden`.
- No post-processing, no drei, no model files.
