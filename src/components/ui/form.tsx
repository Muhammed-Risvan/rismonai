import type { ReactNode } from "react";

/**
 * Shared form primitives (isomorphic, presentational only).
 *
 * These exist because the exact same input class string and the exact same
 * inline error paragraph were copy-pasted across the login, onboarding and
 * dashboard forms. Centralising them keeps styling and accessibility
 * (notably the `role`/`aria-live` wiring) consistent.
 */

/** Standard text input class. Focus rings come from the global rule. */
export const INPUT_CLASS =
  "rounded-md border border-border bg-transparent px-3 py-2 text-base outline-none";

/**
 * A form error. `role="alert"` makes assistive technology announce it as soon
 * as it appears, which the raw copy-pasted markup was doing ad hoc.
 */
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      {message}
    </p>
  );
}

/**
 * A non-error confirmation. `role="status"` + `aria-live="polite"` announces
 * it without interrupting, so a successful save is perceivable rather than
 * silently appearing.
 */
export function FormStatus({ message }: { message: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
    >
      {message}
    </p>
  );
}

/** A labelled form field. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {hint ? (
        <span className="text-xs font-normal text-muted">{hint}</span>
      ) : null}
    </label>
  );
}