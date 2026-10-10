/**
 * Test-only helpers for creating and deleting throwaway Supabase Auth users.
 *
 * These use the SUPABASE_SERVICE_ROLE_KEY through the Supabase admin API. This
 * file lives ONLY under tests/helpers and is NEVER imported by application
 * code. Environment values are never printed.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export type TestUser = {
  id: string;
  email: string;
  password: string;
};

let adminClient: ReturnType<typeof createClient> | undefined;

/** Lazily builds the service-role admin client (test helpers only). */
export function getAdminClient(): ReturnType<typeof createClient> {
  adminClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return adminClient;
}

/** Creates a confirmed throwaway user with a unique @example.invalid email. */
export async function createTestUser(label: string): Promise<TestUser> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `rismon-test-${label}-${unique}@example.invalid`;
  const password = `T-${Math.random().toString(36).slice(2)}-aA9!x`;

  const { data, error } = await getAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      `Failed to create test user: ${error?.message ?? "no user returned"}`,
    );
  }

  return { id: data.user.id, email, password };
}

/** Deletes a user, ignoring errors (e.g. the user was already removed). */
export async function deleteTestUser(id: string): Promise<void> {
  try {
    await getAdminClient().auth.admin.deleteUser(id);
  } catch {
    // Ignore: the user may already have been removed by another path.
  }
}
