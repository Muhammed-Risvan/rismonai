import { describe, expect, it } from "vitest";
import {
  missingAuthEnvLogLine,
  missingAuthEnvVars,
  signInFailureLogLine,
} from "@/server/auth/sign-in-log";

const EMAIL = "learner@example.com";
const PASSWORD = "hunter2-super-secret";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.secret-token-value";

describe("signInFailureLogLine", () => {
  it("contains only a fixed label and the Supabase error code", () => {
    const error = {
      code: "invalid_credentials",
      status: 400,
      message: `Invalid login credentials for ${EMAIL} with ${PASSWORD}`,
      access_token: TOKEN,
    };

    const line = signInFailureLogLine(error);

    expect(line).toBe("auth.signIn failed: invalid_credentials");
    expect(line).not.toContain(EMAIL);
    expect(line).not.toContain(PASSWORD);
    expect(line).not.toContain(TOKEN);
    expect(line).not.toContain("@");
  });

  it("falls back to the HTTP status when there is no code", () => {
    const line = signInFailureLogLine({ status: 429, message: EMAIL });

    expect(line).toBe("auth.signIn failed: status=429");
    expect(line).not.toContain(EMAIL);
  });

  it("never emits message content for unknown errors", () => {
    const line = signInFailureLogLine(new Error(`${EMAIL} ${TOKEN}`));

    expect(line).toBe("auth.signIn failed: unknown");
    expect(line).not.toContain(EMAIL);
    expect(line).not.toContain(TOKEN);
  });

  it("rejects a 'code' that looks like free text (e.g. an email)", () => {
    const line = signInFailureLogLine({ code: EMAIL });

    expect(line).toBe("auth.signIn failed: unknown");
    expect(line).not.toContain(EMAIL);
    expect(line).not.toContain("@");
  });
});

describe("missingAuthEnvVars / missingAuthEnvLogLine", () => {
  it("reports only variable names when config is missing", () => {
    const missing = missingAuthEnvVars({});

    expect(missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);

    const line = missingAuthEnvLogLine(missing);
    expect(line).toBe(
      "auth.env missing: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });

  it("returns nothing when both variables are set", () => {
    expect(
      missingAuthEnvVars({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual([]);
  });

  it("drops anything that is not an env-var name", () => {
    const line = missingAuthEnvLogLine([
      EMAIL,
      TOKEN,
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);

    expect(line).toBe("auth.env missing: NEXT_PUBLIC_SUPABASE_URL");
    expect(line).not.toContain(EMAIL);
    expect(line).not.toContain(TOKEN);
  });
});
