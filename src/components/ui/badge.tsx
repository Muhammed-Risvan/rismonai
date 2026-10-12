import type { HTMLAttributes } from "react";

export type BadgeVariant = "neutral" | "accent";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "border border-border bg-surface text-muted",
  accent: "border border-accent/60 bg-transparent text-accent",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

/** Small label chip — used for "Private beta", "DRAFT, pending review", … */
export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs tracking-tight",
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
