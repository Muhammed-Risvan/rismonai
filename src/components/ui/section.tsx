import type { HTMLAttributes, ReactNode } from "react";

export type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

/** Vertical rhythm between page sections (generous spacing). */
export function Section({ children, className, ...props }: SectionProps) {
  return (
    <section
      className={["py-16 md:py-24", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </section>
  );
}
