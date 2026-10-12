/**
 * Server-side sign-in logging helpers (pure, unit-tested).
 *
 * These extract NOTHING from an error except a short machine-readable
 * Supabase error code or HTTP status. Emails, passwords, tokens, keys,
 * messages and whole error objects must never reach the log.
 */

const FAILURE_LABEL = "auth.signIn failed";
const ENV_LABEL = "auth.env missing";

/** Supabase codes look like `invalid_credentials` — no spaces, no @, no =. */
const CODE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const REQUIRED_AUTH_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function extractCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) return null;
  return code;
}

function extractStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== "number" || !Number.isInteger(status)) return null;
  if (status < 100 || status > 599) return null;
  return status;
}

/**
 * One short line for a failed sign-in, e.g.
 * `auth.signIn failed: invalid_credentials`.
 * Falls back to a numeric status, then to `unknown` — never free text.
 */
export function signInFailureLogLine(error: unknown): string {
  const code = extractCode(error);
  if (code !== null) return `${FAILURE_LABEL}: ${code}`;
  const status = extractStatus(error);
  if (status !== null) return `${FAILURE_LABEL}: status=${status}`;
  return `${FAILURE_LABEL}: unknown`;
}

/**
 * Names of the auth env vars missing at runtime, e.g.
 * `["NEXT_PUBLIC_SUPABASE_URL"]` — names only, never values.
 */
export function missingAuthEnvVars(
  env: Record<string, string | undefined>,
): string[] {
  return REQUIRED_AUTH_ENV.filter((name) => !env[name]);
}

/**
 * One short line for missing configuration, e.g.
 * `auth.env missing: NEXT_PUBLIC_SUPABASE_URL`.
 * Only values matching an env-var name pattern are included.
 */
export function missingAuthEnvLogLine(missing: readonly string[]): string {
  const names = missing.filter((name) => ENV_NAME_PATTERN.test(name));
  return `${ENV_LABEL}: ${names.join(", ")}`;
}
