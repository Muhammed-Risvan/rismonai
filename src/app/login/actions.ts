"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  missingAuthEnvLogLine,
  missingAuthEnvVars,
  signInFailureLogLine,
} from "@/server/auth/sign-in-log";

export type SignInResult = { ok: true } | { ok: false; message: string };

// Generic messages: never reveal whether the account exists.
const INVALID_MESSAGE = "Invalid email or password.";
const FAILED_MESSAGE = "Sign-in failed. Please try again.";

/**
 * Email + password sign-in, executed on the server so failures can be
 * logged there. The log line carries only a fixed label plus the Supabase
 * error code/status — never emails, passwords, tokens or error objects.
 * Runs in all environments (no NODE_ENV guard).
 */
export async function signInAction(
  email: string,
  password: string,
): Promise<SignInResult> {
  // Missing config is logged by variable NAME only, never values.
  const missing = missingAuthEnvVars(process.env);
  if (missing.length > 0) {
    console.error(missingAuthEnvLogLine(missing));
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    // Supabase URL / anon key not set — logged by name above.
    return { ok: false, message: FAILED_MESSAGE };
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error(signInFailureLogLine(error));
      return { ok: false, message: INVALID_MESSAGE };
    }
    return { ok: true };
  } catch (error) {
    console.error(signInFailureLogLine(error));
    return { ok: false, message: FAILED_MESSAGE };
  }
}
