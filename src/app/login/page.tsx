"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        // Generic message: never reveal whether the account exists.
        setError("Invalid email or password.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 p-8 dark:border-zinc-800">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to your Rismon account.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}