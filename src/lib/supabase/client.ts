import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components ("use client").
 * Uses the public anon/publishable key only. Env is read lazily so builds
 * succeed without configuration.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not set");
  }
  return createBrowserClient(url, key);
}