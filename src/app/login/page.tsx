"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { signInAction } from "./actions";

const INPUT_CLASS =
  "rounded-md border border-border bg-transparent px-3 py-2 text-base outline-none";

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
      // Runs on the server; failures are logged there (label + code only).
      const result = await signInAction(email, password);
      if (!result.ok) {
        // Generic message: never reveal whether the account exists.
        setError(result.message);
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
    <main id="main" className="flex flex-1 items-center justify-center px-6 py-16">
      <Container>
        <div className="mx-auto flex w-full max-w-sm flex-col">
        <div className="rounded-lg border border-border bg-surface p-8">
          <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
          <p className="mb-6 text-sm text-muted">
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted">
            <Link href="/" className="underline underline-offset-2">
              Back to home
            </Link>
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-border p-4">
          <Badge variant="accent">Private beta</Badge>
          <p className="mt-3 text-sm text-muted">
            Rismon is in private beta. Don&apos;t have an account yet?
          </p>
          <p className="mt-3">
            <Link
              href="/beta"
              className="text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              Request beta access
            </Link>
          </p>
        </div>
        </div>
      </Container>
    </main>
  );
}