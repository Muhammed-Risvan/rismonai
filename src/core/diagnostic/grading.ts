/**
 * M3 diagnostic grading (pure).
 *
 * Every diagnostic submission is graded deterministically against the
 * immutable run snapshot's accepted answers. No hints exist in diagnostic
 * mode (independent submissions only), no fuzzy matching, no AI.
 * Richer normalization is an M6 concern; this rule is frozen for M3.
 */

/** Normalizes a raw response for comparison: trim, collapse whitespace, lowercase. */
export function normalizeDiagnosticResponse(response: string): string {
  return response.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Returns `true` iff the normalized response exactly matches any normalized
 * accepted answer. An empty response is always incorrect (never throws).
 */
export function gradeDiagnosticAnswer(
  response: string,
  accepted: readonly string[],
): boolean {
  const normalized = normalizeDiagnosticResponse(response);
  if (normalized === "") {
    return false;
  }
  return accepted.some(
    (candidate) => normalizeDiagnosticResponse(candidate) === normalized,
  );
}
