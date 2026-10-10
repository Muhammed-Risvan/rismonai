import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GET as getProfile, PATCH as patchProfile } from "@/app/api/profile/route";
import { GET as getGoals, POST as postGoal } from "@/app/api/goals/route";
import {
  GET as getGoal,
  PATCH as patchGoal,
} from "@/app/api/goals/[id]/route";
import { POST as postGoalStatus } from "@/app/api/goals/[id]/status/route";

const GOAL_ID = "00000000-0000-4000-8000-000000000000";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: null }, error: null }),
    },
  } as never);
});

function context() {
  return { params: Promise.resolve({ id: GOAL_ID }) };
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expect401(response: Response): Promise<void> {
  expect(response.status).toBe(401);
  // Safe message only — never stack traces or database errors.
  expect(await response.json()).toEqual({
    error: "Authentication required",
  });
}

describe("route handlers without a session", () => {
  it("GET /api/profile returns 401", async () => {
    await expect401(await getProfile());
  });

  it("PATCH /api/profile returns 401 before validating the body", async () => {
    await expect401(
      await patchProfile(jsonRequest("PATCH", { display_name: "Ada" })),
    );
  });

  it("GET /api/goals returns 401", async () => {
    await expect401(await getGoals());
  });

  it("POST /api/goals returns 401 before validating the body", async () => {
    await expect401(await postGoal(jsonRequest("POST", { title: "Learn SQL" })));
  });

  it("GET /api/goals/[id] returns 401", async () => {
    await expect401(await getGoal(new Request("http://localhost/api/test"), context()));
  });

  it("PATCH /api/goals/[id] returns 401 before validating the body", async () => {
    await expect401(
      await patchGoal(
        jsonRequest("PATCH", { title: "Renamed" }),
        context(),
      ),
    );
  });

  it("POST /api/goals/[id]/status returns 401 before validating the body", async () => {
    await expect401(
      await postGoalStatus(
        jsonRequest("POST", { status: "active" }),
        context(),
      ),
    );
  });
});