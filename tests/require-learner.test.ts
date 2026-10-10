import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireLearner } from "@/server/auth/require-learner";
import { UnauthenticatedError } from "@/server/errors";

const mockedCreate = vi.mocked(createSupabaseServerClient);

function mockGetUser(result: {
  data: { user: unknown };
  error: unknown;
}): void {
  mockedCreate.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue(result) },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireLearner", () => {
  it("throws UnauthenticatedError when there is no session", async () => {
    mockGetUser({ data: { user: null }, error: null });
    await expect(requireLearner()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws UnauthenticatedError when the session is invalid", async () => {
    mockGetUser({
      data: { user: null },
      error: new Error("invalid JWT: token is not a valid JWT"),
    });
    await expect(requireLearner()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("returns learnerId and email from the server-verified user", async () => {
    mockGetUser({
      data: { user: { id: "user-uuid-1", email: "learner@example.com" } },
      error: null,
    });
    await expect(requireLearner()).resolves.toEqual({
      learnerId: "user-uuid-1",
      email: "learner@example.com",
    });
  });

  it("returns an empty email when the user record has none", async () => {
    mockGetUser({
      data: { user: { id: "user-uuid-2" } },
      error: null,
    });
    await expect(requireLearner()).resolves.toEqual({
      learnerId: "user-uuid-2",
      email: "",
    });
  });
});