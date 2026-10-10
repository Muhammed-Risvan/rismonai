"use client";

import { useCallback, useState, type FormEvent } from "react";
import { isValidTimeZone } from "@/lib/timezone";
import { GOAL_TRANSITIONS, type GoalStatus } from "@/lib/goals/transitions";
import type { GoalDto, ProfileDto } from "@/server/http/dto";
import { signOutAction } from "./actions";

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
  completed: "Completed",
};

const TRANSITION_LABELS: Record<GoalStatus, string> = {
  active: "Resume",
  paused: "Pause",
  archived: "Archive",
  completed: "Complete",
};

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = "Request failed";
    try {
      const data: unknown = await response.json();
      if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
      ) {
        message = data.error;
      }
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return response;
}

type Props = {
  email: string;
  initialProfile: ProfileDto;
  initialGoals: GoalDto[];
};

export function DashboardClient({ email, initialProfile, initialGoals }: Props) {
  const [goals, setGoals] = useState(initialGoals);

  const [displayName, setDisplayName] = useState(
    initialProfile.display_name ?? "",
  );
  const [timezone, setTimezone] = useState(initialProfile.timezone);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetOutcome, setTargetOutcome] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refreshGoals = useCallback(async () => {
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const response = await apiFetch("/api/goals");
      setGoals((await response.json()) as GoalDto[]);
    } catch (error) {
      setGoalsError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);
    if (!isValidTimeZone(timezone)) {
      setProfileError(
        "Please enter a valid IANA timezone, e.g. Europe/London.",
      );
      setProfileSaving(false);
      return;
    }
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName === "" ? null : displayName,
          timezone,
        }),
      });
      setProfileMessage("Profile saved.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Request failed",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateSaving(true);
    setCreateError(null);
    if (title.trim() === "") {
      setCreateError("Please enter a title.");
      setCreateSaving(false);
      return;
    }
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() === "" ? null : description.trim(),
          target_outcome:
            targetOutcome.trim() === "" ? null : targetOutcome.trim(),
          deadline: deadline === "" ? null : deadline,
          hours_per_week: hoursPerWeek === "" ? null : Number(hoursPerWeek),
        }),
      });
      setTitle("");
      setDescription("");
      setTargetOutcome("");
      setDeadline("");
      setHoursPerWeek("");
      await refreshGoals();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setCreateSaving(false);
    }
  }

  async function changeStatus(goalId: string, status: GoalStatus) {
    setBusyGoalId(goalId);
    setGoalsError(null);
    try {
      await apiFetch(`/api/goals/${goalId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refreshGoals();
    } catch (error) {
      setGoalsError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusyGoalId(null);
    }
  }

  const inputClass =
    "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-zinc-500 dark:border-zinc-700";

  return (
    <div className="mt-4 flex flex-col gap-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{email}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Display name
            <input
              type="text"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Timezone
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. Europe/London"
              className={inputClass}
            />
          </label>

          {profileError && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {profileError}
            </p>
          )}
          {profileMessage && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              {profileMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={profileSaving}
            className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Goals</h2>

        {goalsError && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {goalsError}
          </p>
        )}

        {goalsLoading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Loading goals…
          </p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No goals yet. Create your first goal below.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {goals.map((goal) => {
              const status = goal.status as GoalStatus;
              const nextStatuses = GOAL_TRANSITIONS[status] ?? [];
              return (
                <li
                  key={goal.id}
                  className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-medium">{goal.title}</p>
                      {goal.description && (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {goal.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>
                          Status: {STATUS_LABELS[status] ?? goal.status}
                        </span>
                        {goal.target_outcome && (
                          <span>Outcome: {goal.target_outcome}</span>
                        )}
                        {goal.deadline && <span>Deadline: {goal.deadline}</span>}
                        {goal.hours_per_week !== null && (
                          <span>{goal.hours_per_week} h/week</span>
                        )}
                      </div>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-900">
                      {STATUS_LABELS[status] ?? goal.status}
                    </span>
                  </div>

                  {nextStatuses.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {nextStatuses.map((next) => (
                        <button
                          key={next}
                          type="button"
                          disabled={busyGoalId === goal.id}
                          onClick={() => void changeStatus(goal.id, next)}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          {busyGoalId === goal.id
                            ? "Working…"
                            : TRANSITION_LABELS[next]}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={handleCreateGoal}
          className="flex flex-col gap-4 rounded-xl border border-dashed border-zinc-300 p-6 dark:border-zinc-700"
        >
          <h3 className="text-base font-semibold">New goal</h3>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title *
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Learn piano basics"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Description
            <textarea
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Target outcome
            <input
              type="text"
              maxLength={500}
              value={targetOutcome}
              onChange={(e) => setTargetOutcome(e.target.value)}
              placeholder="e.g. Play 3 songs without sheet music"
              className={inputClass}
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Deadline
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Hours per week
              <input
                type="number"
                min={1}
                max={80}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="e.g. 5"
                className={inputClass}
              />
            </label>
          </div>

          {createError && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={createSaving}
            className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {createSaving ? "Creating…" : "Create goal"}
          </button>
        </form>
      </section>
    </div>
  );
}