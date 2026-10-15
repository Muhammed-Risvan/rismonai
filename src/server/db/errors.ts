/**
 * Maps a database error to "unique violation" (PostgreSQL SQLSTATE 23505).
 *
 * Drizzle wraps every failed statement in `DrizzleQueryError`
 * ("Failed query: ...") and keeps the driver error (which carries
 * `code: "23505"`) on `error.cause`, so the cause chain is unwrapped here with
 * a depth bound (self-referencing causes must not loop forever) before giving
 * up. Without the unwrapping the unique-index conflict recovery paths in the
 * services are unreachable and concurrent writers surface the raw error.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 3; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return false;
    }
    if (
      "code" in current &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    if (!("cause" in current)) {
      return false;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}