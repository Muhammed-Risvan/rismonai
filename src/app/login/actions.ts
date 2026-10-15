"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  missingAuthEnvLogLine,
  missingAuthEnvVars,
  signInFailureLogLine,
  signUpFailureLogLine,
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
      // Only credential rejections say so; provider outages and rate limits
      // get the generic failure message instead of blaming the password.
      const code = typeof error.code === "string" ? error.code : "";
      return code === "invalid_credentials" || code === "invalid_grant"
        ? { ok: false, message: INVALID_MESSAGE }
        : { ok: false, message: FAILED_MESSAGE };
    }
    return { ok: true };
  } catch (error) {
    console.error(signInFailureLogLine(error));
    return { ok: false, message: FAILED_MESSAGE };
  }
}

export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; message: string };

// Generic messages: never reveal whether an account already exists.
const EMAIL_TAKEN_MESSAGE =
  "That email cannot be used for a new account. Try signing in instead.";
const SIGN_UP_FAILED_MESSAGE = "Sign-up failed. Please try again.";
const PASSWORD_TOO_SHORT_MESSAGE =
  "Choose a password with at least 8 characters.";

/**
 * Email + password account creation, executed on the server so failures can
 * be logged there with the same discipline as sign-in (fixed label plus a
 * Supabase code/status only).
 *
 * Returns `needsEmailConfirmation` honestly: when Supabase requires
 * confirmation, no session cookie is issued and the client must tell the user
 * to check their inbox rather than pretending they are signed in.
 */
export async function signUpAction(
  email: string,
  password: string,
): Promise<SignUpResult> {
  // Client-side minimum is 8 (see passwordSchema); refuse before a round-trip.
  if (password.length < 8) {
    return { ok: false, message: PASSWORD_TOO_SHORT_MESSAGE };
  }

  const missing = missingAuthEnvVars(process.env);
  if (missing.length > 0) {
    console.error(missingAuthEnvLogLine(missing));
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { ok: false, message: SIGN_UP_FAILED_MESSAGE };
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error(signUpFailureLogLine(error));
      const code = typeof error.code === "string" ? error.code : "";
      // Never confirm or deny an existing account beyond this generic text.
      return code === "user_already_exists" || code === "email_exists"
        ? { ok: false, message: EMAIL_TAKEN_MESSAGE }
        : { ok: false, message: SIGN_UP_FAILED_MESSAGE };
    }
    // A session exists only when the user is already confirmed.
    return {
      ok: true,
      needsEmailConfirmation: data.session === null,
    };
  } catch (error) {
    console.error(signUpFailureLogLine(error));
    return { ok: false, message: SIGN_UP_FAILED_MESSAGE };
  }
}
