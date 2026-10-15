import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signUpFailureLogLine } from "@/server/auth/sign-in-log";
import { signInAction, signUpAction } from "@/app/login/actions";

const mockedCreate = vi.mocked(createSupabaseServerClient);

const EMAIL = "learner@example.com";
const PASSWORD = "unit-test-password";

let errorSpy: MockInstance;

beforeEach(() => {
  vi.clearAllMocks();
  // The action logs missing auth env vars by NAME; give it present (fake)
  // values so a successful sign-in is expected to be completely silent.
  // No real project values are used anywhere in this file.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

function mockSignIn(
  result: { data: unknown; error: unknown } | Error,
): ReturnType<typeof vi.fn> {
  const signIn = vi.fn();
  if (result instanceof Error) {
    signIn.mockRejectedValue(result);
  } else {
    signIn.mockResolvedValue(result);
  }
  mockedCreate.mockResolvedValue({ auth: { signInWithPassword: signIn } } as never);
  return signIn;
}

/** Everything the action logged, joined — used for secret-safety assertions. */
function loggedText(): string {
  return errorSpy.mock.calls.flat().map(String).join(" ");
}

describe("signInAction", () => {
  it("returns ok and logs nothing on success", async () => {
    const signIn = mockSignIn({
      data: { user: { id: "user-1" } },
      error: null,
    });

    await expect(signInAction(EMAIL, PASSWORD)).resolves.toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("shows the generic rejection message for invalid credentials and logs only the code", async () => {
    mockSignIn({
      data: { user: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });

    await expect(signInAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Invalid email or password.",
    });
    expect(loggedText()).toContain("auth.signIn failed: invalid_credentials");
    // Secret safety: emails, passwords and provider messages never log.
    expect(loggedText()).not.toContain(EMAIL);
    expect(loggedText()).not.toContain(PASSWORD);
    expect(loggedText()).not.toContain("Invalid login credentials");
  });

  it("maps invalid_grant to the same generic rejection message", async () => {
    mockSignIn({
      data: { user: null },
      error: { code: "invalid_grant", message: "Invalid Refresh Token" },
    });

    await expect(signInAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Invalid email or password.",
    });
    expect(loggedText()).toContain("auth.signIn failed: invalid_grant");
  });

  it("does not blame the password for provider errors such as rate limits", async () => {
    mockSignIn({
      data: { user: null },
      error: { code: "over_request_rate_limit", message: "Request rate limit reached" },
    });

    await expect(signInAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Sign-in failed. Please try again.",
    });
    expect(loggedText()).toContain("auth.signIn failed: over_request_rate_limit");
    expect(loggedText()).not.toContain("Request rate limit reached");
  });

  it("returns the generic failure message when the request throws", async () => {
    mockSignIn(new Error("fetch failed contacting the auth service"));

    await expect(signInAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Sign-in failed. Please try again.",
    });
    // A thrown error carries no machine-readable code — logged as unknown,
    // never the error message itself.
    expect(loggedText()).toContain("auth.signIn failed: unknown");
    expect(loggedText()).not.toContain("fetch failed");
  });

  it("fails safely when the Supabase client cannot be created", async () => {
    mockSignIn({ data: { user: null }, error: null });
    mockedCreate.mockRejectedValue(
      new Error("Supabase environment variables are not set"),
    );

    await expect(signInAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Sign-in failed. Please try again.",
    });
  });

  it("logs missing auth env vars by name only and still fails safely", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    mockedCreate.mockRejectedValue(
      new Error("Supabase environment variables are not set"),
    );

    await expect(signInAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Sign-in failed. Please try again.",
    });
    expect(loggedText()).toContain("auth.env missing: NEXT_PUBLIC_SUPABASE_URL");
    expect(loggedText()).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(loggedText()).not.toContain("test-anon-key");
    expect(loggedText()).not.toContain("https://example");
  });
});

function mockSignUp(
  result: { data: unknown; error: unknown } | Error,
): ReturnType<typeof vi.fn> {
  const signUp = vi.fn();
  if (result instanceof Error) {
    signUp.mockRejectedValue(result);
  } else {
    signUp.mockResolvedValue(result);
  }
  mockedCreate.mockResolvedValue({ auth: { signUp } } as never);
  return signUp;
}

describe("signUpAction", () => {
  it("returns ok and logs nothing when a session is issued", async () => {
    const signUp = mockSignUp({
      data: { user: { id: "user-1" }, session: { access_token: "redacted" } },
      error: null,
    });

    await expect(signUpAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: true,
      needsEmailConfirmation: false,
    });
    expect(signUp).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("honestly reports that confirmation is needed when no session is issued", async () => {
    mockSignUp({ data: { user: { id: "user-1" }, session: null }, error: null });

    await expect(signUpAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: true,
      needsEmailConfirmation: true,
    });
  });

  it("rejects a short password before contacting the provider", async () => {
    const signUp = mockSignUp({ data: null, error: null });

    await expect(signUpAction(EMAIL, "short")).resolves.toEqual({
      ok: false,
      message: "Choose a password with at least 8 characters.",
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("never confirms whether an account already exists, and logs only the code", async () => {
    mockSignUp({
      data: null,
      error: {
        code: "user_already_exists",
        message: "A user with this email address has already been registered",
      },
    });

    await expect(signUpAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message:
        "That email cannot be used for a new account. Try signing in instead.",
    });
    expect(loggedText()).toContain("auth.signUp failed: user_already_exists");
    expect(loggedText()).not.toContain(EMAIL);
    expect(loggedText()).not.toContain("already been registered");
  });

  it("does not blame the user for rate limiting", async () => {
    mockSignUp({
      data: null,
      error: { code: "over_request_rate_limit", message: "Try again later" },
    });

    await expect(signUpAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Sign-up failed. Please try again.",
    });
    expect(loggedText()).toContain("auth.signUp failed: over_request_rate_limit");
    expect(loggedText()).not.toContain("Try again later");
  });

  it("fails safely when the request throws, without leaking the message", async () => {
    mockSignUp(new Error("connection reset by the auth service"));

    await expect(signUpAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Sign-up failed. Please try again.",
    });
    expect(loggedText()).toContain("auth.signUp failed: unknown");
    expect(loggedText()).not.toContain("connection reset");
  });

  it("fails safely when the Supabase client cannot be created", async () => {
    mockedCreate.mockRejectedValue(
      new Error("Supabase environment variables are not set"),
    );

    await expect(signUpAction(EMAIL, PASSWORD)).resolves.toEqual({
      ok: false,
      message: "Sign-up failed. Please try again.",
    });
  });
});

describe("signUpFailureLogLine", () => {
  it("never includes free text from the provider error", () => {
    const line = signUpFailureLogLine({
      code: "over_request_rate_limit",
      message: "Rate limit reached for 192.0.2.1",
    });
    expect(line).toBe("auth.signUp failed: over_request_rate_limit");
    expect(line).not.toContain("192.0.2.1");
  });

  it("falls back to a numeric status, then to unknown", () => {
    expect(signUpFailureLogLine({ status: 503 })).toBe(
      "auth.signUp failed: status=503",
    );
    expect(signUpFailureLogLine(new Error("boom"))).toBe(
      "auth.signUp failed: unknown",
    );
  });
});
