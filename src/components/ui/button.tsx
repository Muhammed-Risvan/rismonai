import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-opacity disabled:pointer-events-none disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  // Primary: solid, foreground background (auto-inverts light/dark, always AA).
  primary: "bg-foreground text-background hover:opacity-90",
  // Secondary: outline.
  secondary:
    "border border-border bg-transparent text-foreground hover:bg-surface",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2",
};

/** Class string for a button-shaped control (also used for link buttons). */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return [BASE, VARIANTS[variant], SIZES[size], className]
    .filter(Boolean)
    .join(" ");
}

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  SharedProps;

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  SharedProps & {
    href: string;
  };

/**
 * A button-styled link. Internal paths use next/link; anything else
 * (mailto:, external) renders a plain anchor.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: ButtonLinkProps) {
  const classes = buttonClasses(variant, size, className);
  if (href.startsWith("/")) {
    return <Link href={href} className={classes} {...props} />;
  }
  return <a href={href} className={classes} {...props} />;
}
