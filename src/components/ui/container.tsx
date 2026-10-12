import type { HTMLAttributes, ReactNode } from "react";

export type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** "narrow" is for text-heavy pages (privacy, terms, contact). */
  size?: "default" | "narrow";
};

const SIZES = {
  default: "max-w-5xl",
  narrow: "max-w-3xl",
};

/** Horizontal page gutter + max-width wrapper. */
export function Container({
  children,
  size = "default",
  className,
  ...props
}: ContainerProps) {
  return (
    <div
      className={["mx-auto w-full px-6", SIZES[size], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
