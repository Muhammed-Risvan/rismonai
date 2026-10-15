"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError, INPUT_CLASS } from "@/components/ui/form";
import type { AmbitionDto } from "@/server/http/dto";
import { startJourneyAction } from "./actions";

type Props = {
  ambitions: AmbitionDto[];
};

/**
 * M2 onboarding form. Presents the catalog, collects the smallest
 * SMART-shaped input (outcome + weekly time + optional extras), and submits
 * to the `startJourneyAction` server action. On success the action redirects
 * to the dashboard; on failure a safe message is shown inline.
 */
export function OnboardingForm({ ambitions }: Props) {
  const [ambitionId, setAmbitionId] = useState(ambitions[0]?.id ?? "");
  const [outcome, setOutcome] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [background, setBackground] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    if (ambitionId === "") {
      setError("Please choose an ambition to begin.");
      setLoading(false);
      return;
    }
    if (outcome.trim() === "") {
      setError("Please describe what you want to achieve.");
      setLoading(false);
      return;
    }
    const formData = new FormData();
    formData.set("ambitionId", ambitionId);
    formData.set("outcome", outcome.trim());
    formData.set("hoursPerWeek", hoursPerWeek);
    formData.set("background", background.trim());
    formData.set("deadline", deadline);
    try {
      // Runs on the server; the action redirects to /dashboard on success.
      const result = await startJourneyAction(formData);
      if (!result.ok) {
        setError(result.message);
      }
    } catch {
      setError("Could not start your journey. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          1. Choose your ambition
        </legend>
        {ambitions.map((ambition) => (
          <label
            key={ambition.id}
            className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border p-4 has-checked:border-foreground"
          >
            <span className="flex items-center gap-2 text-base font-medium">
              <input
                type="radio"
                name="ambition"
                value={ambition.id}
                checked={ambitionId === ambition.id}
                onChange={() => setAmbitionId(ambition.id)}
                className="accent-foreground"
              />
              {ambition.name}
            </span>
            <span className="pl-6 text-sm text-muted">
              {ambition.description}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">2. Shape your goal</p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          What do you want to achieve? (be specific)
          <textarea
            required
            rows={3}
            maxLength={500}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Get an entry-level cloud security role within a year"
            className={INPUT_CLASS}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Hours per week you can study
            <input
              type="number"
              required
              min={1}
              max={80}
              inputMode="numeric"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
              placeholder="e.g. 6"
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Target date <span className="font-normal text-muted">(optional)</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your background{" "}
          <span className="font-normal text-muted">(optional)</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="e.g. No programming experience yet; comfortable with computers."
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {error && <FormError message={error} />}

      <Button type="submit" disabled={loading}>
        {loading ? "Starting your journey…" : "Start my journey"}
      </Button>
    </form>
  );
}
