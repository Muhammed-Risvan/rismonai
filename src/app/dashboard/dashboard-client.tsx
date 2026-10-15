"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError, FormStatus, INPUT_CLASS } from "@/components/ui/form";
import { isValidTimeZone } from "@/lib/timezone";
import { GOAL_TRANSITIONS, type GoalStatus } from "@/lib/goals/transitions";
import type { AmbitionDto, GoalDto, ProfileDto } from "@/server/http/dto";
import { signOutAction } from "./actions";

/**
 * Dashboard client — a THIN view over the goal/profile APIs.
 *
 * It holds no business logic: status changes are offered from the shared
 * transition table (`@/lib/goals/transitions`, the same one the server
 * enforces) rather than a second hand-written copy of the rules, and the
 * server remains the authority on what is actually permitted.
 */

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
  ambitions: AmbitionDto[];
};

export function DashboardClient({
  email,
  initialProfile,
  initialGoals,
  ambitions,
}: Props) {
  const [goals, setGoals] = useState(initialGoals);

  return (
    <div className="mt-4 flex flex-col gap-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">{email}</p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      <StartHere />

      <ProfileForm initialProfile={initialProfile} />

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Goals</h2>
        <GoalList
          goals={goals}
          ambitions={ambitions}
          onChanged={setGoals}
        />
        <NewGoalForm ambitions={ambitions} onCreated={setGoals} />
      </section>
    </div>
  );
}

/**
 * The single best next thing. This is deliberately a link, not a computed
 * recommendation: the planner (M8) will replace it with an engine-produced
 * activity and a reason. Until then it must not pretend to personalise.
 */
function StartHere() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="font-semibold">Start here</h2>
      <p className="mt-2 text-sm text-muted">
        Find out what you already know, so your journey starts from the right
        place instead of the beginning.
      </p>
      <div className="mt-4">
        <Link
          href="/diagnostic"
          className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Take the starting diagnostic
        </Link>
      </div>
    </section>
  );
}

function ProfileForm({ initialProfile }: { initialProfile: ProfileDto }) {
  const [displayName, setDisplayName] = useState(
    initialProfile.display_name ?? "",
  );
  const [timezone, setTimezone] = useState(initialProfile.timezone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    if (!isValidTimeZone(timezone)) {
      setError("Please enter a valid IANA timezone, e.g. Europe/London.");
      setSaving(false);
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
      setMessage("Profile saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border p-6">
      <h2 className="mb-4 text-lg font-semibold">Profile</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Display name
          <input
            type="text"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Timezone
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. Europe/London"
            className={INPUT_CLASS}
          />
        </label>

        {error ? <FormError message={error} /> : null}
        {message ? <FormStatus message={message} /> : null}

        <Button type="submit" disabled={saving} className="w-fit">
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </section>
  );
}

function GoalList({
  goals,
  ambitions,
  onChanged,
}: {
  goals: GoalDto[];
  ambitions: AmbitionDto[];
  onChanged: (goals: GoalDto[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);
  const ambitionNames = new Map(ambitions.map((a) => [a.id, a.name]));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/goals");
      onChanged((await response.json()) as GoalDto[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [onChanged]);

  async function changeStatus(goalId: string, status: GoalStatus) {
    setBusyGoalId(goalId);
    setError(null);
    try {
      await apiFetch(`/api/goals/${goalId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setBusyGoalId(null);
    }
  }

  /**
   * Links a subject to an existing goal. Without this a goal created here can
   * never reach the diagnostic or a roadmap (the engine reports
   * "no-ambition"), and the learner had no way to repair it.
   */
  async function linkAmbition(goalId: string, ambitionId: string) {
    setBusyGoalId(goalId);
    setError(null);
    try {
      await apiFetch(`/api/goals/${goalId}/ambition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ambitionId }),
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setBusyGoalId(null);
    }
  }

  return (
    <>
      {error ? <FormError message={error} /> : null}

      {loading ? (
        <p aria-live="polite" className="text-sm text-muted">
          Loading goals…
        </p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-muted">
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
                className="rounded-lg border border-border p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium">{goal.title}</p>
                    {goal.description && (
                      <p className="mt-1 text-sm text-muted">
                        {goal.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>
                        Status: {STATUS_LABELS[status] ?? goal.status}
                      </span>
                      {goal.ambition_id && (
                        <span>
                          Subject:{" "}
                          {ambitionNames.get(goal.ambition_id) ??
                            goal.ambition_id}
                        </span>
                      )}
                      {goal.target_outcome && (
                        <span>Outcome: {goal.target_outcome}</span>
                      )}
                      {goal.deadline && <span>Deadline: {goal.deadline}</span>}
                      {goal.hours_per_week !== null && (
                        <span>{goal.hours_per_week} h/week</span>
                      )}
                    </div>
                  </div>
                  <Badge>{STATUS_LABELS[status] ?? goal.status}</Badge>
                </div>

                {goal.ambition_id === null ? (
                  <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                      Link a subject so this journey can be assessed
                      <select
                        defaultValue={ambitions[0]?.id ?? ""}
                        disabled={busyGoalId === goal.id || ambitions.length === 0}
                        onChange={(e) => {
                          if (e.target.value) {
                            void linkAmbition(goal.id, e.target.value);
                          }
                        }}
                        className="rounded-md border border-border bg-transparent px-3 py-2 text-base"
                      >
                        {ambitions.length === 0 ? (
                          <option value="">No subjects available</option>
                        ) : null}
                        {ambitions.map((ambition) => (
                          <option key={ambition.id} value={ambition.id}>
                            {ambition.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {nextStatuses.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {nextStatuses.map((next) => (
                      <Button
                        key={next}
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyGoalId === goal.id}
                        onClick={() => void changeStatus(goal.id, next)}
                      >
                        {busyGoalId === goal.id
                          ? "Working…"
                          : TRANSITION_LABELS[next]}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function NewGoalForm({
  ambitions,
  onCreated,
}: {
  ambitions: AmbitionDto[];
  onCreated: (goals: GoalDto[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetOutcome, setTargetOutcome] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [ambitionId, setAmbitionId] = useState(ambitions[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch("/api/goals");
    onCreated((await response.json()) as GoalDto[]);
  }, [onCreated]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    if (title.trim() === "") {
      setError("Please enter a title.");
      setSaving(false);
      return;
    }
    // An empty number field must normalise to null, not 0 — the server would
    // reject 0 (min 1) and the learner would see a spurious validation error.
    const hours = hoursPerWeek.trim() === "" ? null : Number(hoursPerWeek);
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
          hours_per_week: hours,
          ambition_id: ambitionId === "" ? null : ambitionId,
        }),
      });
      setTitle("");
      setDescription("");
      setTargetOutcome("");
      setDeadline("");
      setHoursPerWeek("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-6"
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
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Subject
        <select
          value={ambitionId}
          onChange={(e) => setAmbitionId(e.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-base"
        >
          {ambitions.map((ambition) => (
            <option key={ambition.id} value={ambition.id}>
              {ambition.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <textarea
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={INPUT_CLASS}
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
          className={INPUT_CLASS}
        />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Deadline
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {error ? <FormError message={error} /> : null}

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Creating…" : "Create goal"}
      </Button>
    </form>
  );
}