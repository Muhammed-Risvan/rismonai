"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, FormError, FormStatus, INPUT_CLASS } from "@/components/ui/form";
import { signInAction, signUpAction } from "./actions";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // isPending (unlike a manual setLoading(true)) is tracked by React outside
  // the transition, so the pending state paints immediately even while the
  // awaited server action is in flight. It also always clears when the
  // transition settles — success, handled error, or throw — and its disabled
  // state blocks duplicate submissions.
  const [isPending, startTransition] = useTransition();

  const isSignUp = mode === "sign-up";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        if (isSignUp) {
          const result = await signUpAction(email, password);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          if (result.needsEmailConfirmation) {
            // Honest: no session was issued, so we must NOT navigate.
            setNotice(
              "Check your inbox to confirm your email address, then sign in.",
            );
            setMode("sign-in");
            return;
          }
          router.push("/onboarding");
          return;
        }

        // Runs on the server; failures are logged there (label + code only).
        const result = await signInAction(email, password);
        if (!result.ok) {
          // Generic message: never reveal whether the account exists.
          setError(result.message);
          return;
        }
        // Navigate with router.push ONLY. A router.refresh() here races the
        // navigation: it re-renders the current (login) route, so the push
        // never issues a request to /onboarding. No client-side cache needs
        // refreshing — the session cookie is set on this action's response and
        // /onboarding renders fresh server-side.
        router.push("/onboarding");
      } catch {
        setError(
          isSignUp
            ? "Sign-up failed. Please try again."
            : "Sign-in failed. Please try again.",
        );
      }
    });
  }

  return (
    <main id="main" className="flex flex-1 items-center justify-center px-6 py-16">
      <Container>
        <div className="mx-auto flex w-full max-w-sm flex-col">
          <div className="rounded-lg border border-border bg-surface p-8">
            <h1 className="mb-1 text-2xl font-semibold">
              {isSignUp ? "Create your account" : "Sign in"}
            </h1>
            <p className="mb-6 text-sm text-muted">
              {isSignUp
                ? "Start your Rismon learning journey."
                : "Sign in to your Rismon account."}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field
                label="Password"
                hint={
                  isSignUp ? "At least 8 characters." : undefined
                }
              >
                <input
                  type="password"
                  required
                  minLength={isSignUp ? 8 : undefined}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>

              {error ? <FormError message={error} /> : null}
              {notice ? <FormStatus message={notice} /> : null}

              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isSignUp
                    ? "Creating account…"
                    : "Signing in…"
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>

            <button
              type="button"
              onClick={() =>
                switchMode(isSignUp ? "sign-in" : "sign-up")
              }
              className="mt-4 text-sm text-muted underline underline-offset-4 hover:text-foreground"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "New to Rismon? Create an account"}
            </button>

            <p className="mt-6 text-sm text-muted">
              <Link href="/" className="underline underline-offset-2">
                Back to home
              </Link>
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-border p-4">
            <Badge variant="accent">Private beta</Badge>
            <p className="mt-3 text-sm text-muted">
              Rismon is in private beta. Accounts are created here, and you can
              delete your data at any time.
            </p>
            <p className="mt-3">
              <Link
                href="/beta"
                className="text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                About the beta
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </main>
  );
}