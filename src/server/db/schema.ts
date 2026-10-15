import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { GoalStatus } from "@/lib/goals/transitions";

export type { GoalStatus };

export const learnerProfiles = pgTable(
  "learner_profiles",
  {
    /** Equals the Supabase Auth user id (auth.users.id). No default. */
    id: uuid("id").primaryKey(),
    displayName: text("display_name"),
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "learner_profiles_display_name_max_length",
      sql`length(${table.displayName}) <= 80`,
    ),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    targetOutcome: text("target_outcome"),
    status: text("status").notNull(),
    deadline: date("deadline"),
    hoursPerWeek: integer("hours_per_week"),
    // Links a saved goal to a catalog ambition (nullable, additive). Existing
    // goals keep working with a null ambitionId until M2 assigns one.
    ambitionId: text("ambition_id").references(() => ambitions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("goals_learner_id_idx").on(table.learnerId),
    index("goals_ambition_id_idx").on(table.ambitionId),
    // Only ONE active goal per learner, enforced by the database.
    uniqueIndex("goals_one_active_per_learner")
      .on(table.learnerId)
      .where(sql`status = 'active'`),
    check("goals_title_length", sql`length(${table.title}) between 1 and 200`),
    check(
      "goals_description_max_length",
      sql`length(${table.description}) <= 2000`,
    ),
    check(
      "goals_target_outcome_max_length",
      sql`length(${table.targetOutcome}) <= 500`,
    ),
    check(
      "goals_status_valid",
      sql`${table.status} in ('active','paused','archived','completed')`,
    ),
    check(
      "goals_hours_per_week_range",
      sql`${table.hoursPerWeek} between 1 and 80`,
    ),
  ],
);

/**
 * Catalog of ambitions the product supports (reference data, NOT learner-owned).
 *
 * Ids are stable slugs matching the M0 `Ambition` contract (e.g.
 * "cloud-security-engineer"), so goals can reference them. Seeded from
 * `content/` via an idempotent upsert (see src/server/data/ambitions.ts).
 * This table is public-by-design catalog data, but it still gets RLS + revokes
 * so Supabase's Data API cannot expose or mutate it either; the app reads it
 * through the server-side Drizzle connection only.
 */
export const ambitions = pgTable(
  "ambitions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    targetOutcome: text("target_outcome").notNull(),
    level: text("level").notNull().default("beginner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "ambitions_level_valid",
      sql`${table.level} in ('beginner','intermediate','advanced')`,
    ),
    check("ambitions_name_length", sql`length(${table.name}) between 1 and 120`),
    check(
      "ambitions_target_outcome_max_length",
      sql`length(${table.targetOutcome}) <= 500`,
    ),
  ],
);

export type LearnerProfileRow = typeof learnerProfiles.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type AmbitionRow = typeof ambitions.$inferSelect;

/**
 * M3 baseline-diagnostic runs (one row per attempt at the diagnostic).
 *
 * A run freezes the exact content it started with (`item_ids` order +
 * `items_snapshot` prompts/bindings/keys, validated by the pure
 * `diagnosticSnapshotSchema` at creation and on every load), so a newer
 * catalog release never reorders or re-grades a live run. History is
 * preserved: reassessment inserts a new run; completed runs are never
 * updated in place (submit guards enforce `in_progress`).
 */
export const diagnosticRuns = pgTable(
  "diagnostic_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    // Nullable journey link: deleting a goal preserves the run (SET NULL).
    goalId: uuid("goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    // History must not silently lose its map ref: RESTRICT blocks catalog
    // deletion while runs reference the ambition (unlike goals' SET NULL).
    ambitionId: text("ambition_id")
      .notNull()
      .references(() => ambitions.id, { onDelete: "restrict" }),
    /** Semver copied from the map at run start (audit column). */
    contentVersion: text("content_version").notNull(),
    /** Ordered bank snapshot: item ids in ask order. */
    itemIds: text("item_ids").array().notNull(),
    /**
     * Immutable per-run item snapshot (prompts, capability bindings,
     * accepted answers, order, conditional metadata). Server-only:
     * accepted answers are stripped from every client DTO.
     */
    itemsSnapshot: jsonb("items_snapshot").notNull(),
    /** Scope snapshot: required capability ids for the coverage gate. */
    requiredCapabilityIds: text("required_capability_ids").array().notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("diagnostic_runs_learner_id_idx").on(table.learnerId),
    index("diagnostic_runs_goal_id_idx").on(table.goalId),
    // Composite parent key for the responses FK: the database itself
    // rejects a response whose (run_id, learner_id) pair does not match.
    uniqueIndex("diagnostic_runs_id_learner_id_key").on(
      table.id,
      table.learnerId,
    ),
    // One live run per learner+ambition; races map to ConflictError (23505).
    uniqueIndex("diagnostic_runs_one_in_progress_per_learner_ambition")
      .on(table.learnerId, table.ambitionId)
      .where(sql`status = 'in_progress'`),
    check(
      "diagnostic_runs_status_valid",
      sql`${table.status} in ('in_progress','complete','opted_out')`,
    ),
    check(
      "diagnostic_runs_content_version_semver",
      sql`${table.contentVersion} ~ '^[0-9]+\\.[0-9]+\\.[0-9]+$'`,
    ),
  ],
);

/**
 * M3 diagnostic responses — the EVIDENCE LEDGER (one row per answered item
 * PER RUN). This is the raw evidence every later mastery, revision and
 * planner decision is derived from; it is never rewritten or summarised away.
 *
 * First-answer-wins within a run: `UNIQUE (run_id, item_id)` plus
 * insert-or-select (never update) makes duplicate submits idempotent — the
 * canonical persisted row is returned, correctness never mutated.
 */
export const diagnosticResponses = pgTable(
  "diagnostic_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => diagnosticRuns.id, { onDelete: "cascade" }),
    // Denormalized for the composite FK to (id, learner_id): cross-learner
    // inserts are rejected by the database (see hand-appended SQL below).
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    /** Capability slug copied from the snapshot at submit (audit-stable). */
    capabilityId: text("capability_id").notNull(),
    response: text("response").notNull(),
    correct: boolean("correct").notNull(),
    /**
     * How much help the learner had. `mode` + `hints_used` together decide
     * whether this attempt may ever count as mastery evidence: an assisted
     * pass is progress, never proof (`core/attempt.ts`).
     */
    mode: text("mode").notNull().default("independent"),
    hintsUsed: integer("hints_used").notNull().default(0),
    /**
     * Set ONLY when a wrong answer matched an authored misconception
     * signature. `null` means "incorrect, reason not identified" — an honest
     * gap, never a guess.
     */
    misconceptionId: text("misconception_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("diagnostic_responses_run_id_idx").on(table.runId),
    index("diagnostic_responses_learner_id_idx").on(table.learnerId),
    index("diagnostic_responses_misconception_id_idx").on(table.misconceptionId),
    uniqueIndex("diagnostic_responses_run_id_item_id_key").on(
      table.runId,
      table.itemId,
    ),
    check(
      "diagnostic_responses_item_id_length",
      sql`length(${table.itemId}) between 1 and 120`,
    ),
    check(
      "diagnostic_responses_capability_id_length",
      sql`length(${table.capabilityId}) between 1 and 120`,
    ),
    check(
      "diagnostic_responses_response_length",
      sql`length(${table.response}) between 1 and 500`,
    ),
    check(
      "diagnostic_responses_mode_valid",
      sql`${table.mode} in ('guided','independent')`,
    ),
    check(
      "diagnostic_responses_hints_used_non_negative",
      sql`${table.hintsUsed} >= 0`,
    ),
    // A misconception is the REASON an answer was wrong: attaching one to a
    // correct answer would be meaningless, so the database forbids it.
    check(
      "diagnostic_responses_misconception_implies_incorrect",
      sql`${table.misconceptionId} is null or ${table.correct} = false`,
    ),
  ],
);

/**
 * `attempts` — the general EVIDENCE LEDGER for taught material.
 *
 * Distinct from `diagnostic_responses`, which is a frozen, one-shot
 * instrument: a run snapshots its items, grades against that snapshot, and can
 * never award `mastered`. This table is the ongoing record of a learner working
 * through lessons — practice with help, then the same item again alone.
 *
 * Deliberately NOT unique on (learner_id, item_id). Repeating an item is the
 * point: two independent passes on the SAME question are weaker evidence than
 * passes on different ones, and the mastery engine is what decides that. A
 * unique constraint here would silently destroy the repeat-practice signal.
 *
 * KNOWN LIMITATION (M1): there is no idempotency key, so a client
 * double-submit could record two rows for one click and inflate `demonstrated`
 * evidence. The UI disables the submit control while a request is in flight,
 * which makes this unlikely but not impossible. If it ever matters, adding a
 * nullable `attempt_key` column plus a partial unique index is additive.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    /** Capability this attempt counts toward (the unit of learning). */
    capabilityId: text("capability_id").notNull(),
    /** Item attempted, slug from the reviewed competency map. */
    itemId: text("item_id").notNull(),
    response: text("response").notNull(),
    correct: boolean("correct").notNull(),
    /**
     * How much help the learner had. Together with `hints_used` this decides
     * whether the attempt may ever count as mastery evidence — an assisted pass
     * is progress, never proof (`core/attempt.ts`).
     */
    mode: text("mode").notNull().default("independent"),
    hintsUsed: integer("hints_used").notNull().default(0),
    /**
     * Set ONLY when a wrong answer matched an authored misconception
     * signature. `null` means "incorrect, reason not identified" — an honest
     * gap, never a guess.
     */
    misconceptionId: text("misconception_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Per-learner and per-capability history reads: the full-history evaluator
    // loads every attempt for one capability of one learner.
    index("attempts_learner_id_idx").on(table.learnerId),
    index("attempts_learner_capability_idx").on(
      table.learnerId,
      table.capabilityId,
      table.createdAt,
    ),
    index("attempts_misconception_id_idx").on(table.misconceptionId),
    check(
      "attempts_capability_id_length",
      sql`length(${table.capabilityId}) between 1 and 120`,
    ),
    check(
      "attempts_item_id_length",
      sql`length(${table.itemId}) between 1 and 120`,
    ),
    check(
      "attempts_response_length",
      sql`length(${table.response}) between 1 and 500`,
    ),
    check(
      "attempts_mode_valid",
      sql`${table.mode} in ('guided','independent')`,
    ),
    check("attempts_hints_used_non_negative", sql`${table.hintsUsed} >= 0`),
    /**
     * The load-bearing independence guarantee, enforced by the database: an
     * attempt cannot be recorded as `independent` if any hint was consumed.
     * Without this, a bug upstream could write a hinted pass as independent
     * evidence and silently inflate a learner's level — the exact failure this
     * whole system exists to prevent.
     */
    check(
      "attempts_independent_implies_no_hints",
      sql`${table.mode} <> 'independent' or ${table.hintsUsed} = 0`,
    ),
    // A misconception is the REASON an answer was wrong.
    check(
      "attempts_misconception_implies_incorrect",
      sql`${table.misconceptionId} is null or ${table.correct} = false`,
    ),
  ],
);

/**
 * Current capability level per learner (derived from the most recent completed
 * diagnostic run — the summary row, NOT the history; `diagnostic_responses`
 * remains the append-only evidence ledger behind it). One row per
 * learner+capability.
 *
 * Vocabulary is the seven-state ladder in `src/core/mastery.ts`:
 * `unknown | untested | introduced | practising | demonstrated | mastered |
 * revision-needed`. The diagnostic service always calls `evaluateMastery` with
 * `ceiling: "demonstrated"`, so this table can never receive `mastered` from a
 * diagnostic run — only lesson/practice evidence may award it. That ceiling is
 * service-enforced, not DB-enforced: the CHECK below admits the full closed
 * set so the engine's vocabulary is not silently narrowed by the schema.
 */
export const learnerCapabilities = pgTable(
  "learner_capabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    capabilityId: text("capability_id").notNull(),
    level: text("level").notNull(),
    source: text("source").notNull(),
    /** Provenance: which completed run produced this level (SET NULL keeps it). */
    runId: uuid("run_id").references(() => diagnosticRuns.id, {
      onDelete: "set null",
    }),
    /**
     * How many independent attempts back the current level. `level` on its
     * own is an opinion; this is the receipt, so a reviewer can always answer
     * "what proves this state?" from the ledger itself.
     */
    evidenceCount: integer("evidence_count").notNull().default(0),
    /** True when any backing pass used hints — caps the achievable level. */
    assistedPass: boolean("assisted_pass").notNull().default(false),
    /** When the learner last demonstrated this capability unassisted. */
    lastDemonstratedAt: timestamp("last_demonstrated_at", {
      withTimezone: true,
    }),
    /** When this capability is next due for revision (pure scheduler). */
    reviewAt: timestamp("review_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("learner_capabilities_learner_id_idx").on(table.learnerId),
    // Revision queue: which capabilities are due, soonest first.
    index("learner_capabilities_review_due_idx")
      .on(table.learnerId, table.reviewAt)
      .where(sql`${table.reviewAt} is not null`),
    uniqueIndex("learner_capabilities_learner_id_capability_id_key").on(
      table.learnerId,
      table.capabilityId,
    ),
    check(
      "learner_capabilities_capability_id_length",
      sql`length(${table.capabilityId}) between 1 and 120`,
    ),
    check(
      "learner_capabilities_level_valid",
      sql`${table.level} in ('unknown','untested','introduced','practising','demonstrated','mastered','revision-needed')`,
    ),
    check(
      "learner_capabilities_source_valid",
      sql`${table.source} in ('diagnostic','opt-out')`,
    ),
    check(
      "learner_capabilities_evidence_count_non_negative",
      sql`${table.evidenceCount} >= 0`,
    ),
    // A demonstrated capability must have receipts: this is the database-level
    // version of "no displayed mastery without a recorded passed assessment".
    check(
      "learner_capabilities_mastered_requires_evidence",
      sql`${table.level} <> 'mastered' or ${table.evidenceCount} > 0`,
    ),
  ],
);

/**
 * Learner misconception history — "remember the mistake".
 *
 * One row per (learner, content misconception) the learner has evidenced. The
 * description and remediation themselves live in versioned content; this row
 * records only the learner's exposure to it, so content can be corrected
 * without rewriting learner history.
 */
export const learnerMisconceptions = pgTable(
  "learner_misconceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    /** Capability the misconception belongs to (for roadmap/revision). */
    capabilityId: text("capability_id").notNull(),
    /** Slug of the authored misconception in `content/`. */
    misconceptionId: text("misconception_id").notNull(),
    /** The item that most recently evidenced this misunderstanding. */
    lastItemId: text("last_item_id").notNull(),
    timesEncountered: integer("times_encountered").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set when the learner later passes the related item unassisted. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("learner_misconceptions_learner_id_idx").on(table.learnerId),
    uniqueIndex("learner_misconceptions_learner_id_misconception_id_key").on(
      table.learnerId,
      table.misconceptionId,
    ),
    // Partial index for the revision queue: open items only.
    index("learner_misconceptions_open_idx")
      .on(table.learnerId, table.capabilityId)
      .where(sql`${table.resolvedAt} is null`),
    check(
      "learner_misconceptions_capability_id_length",
      sql`length(${table.capabilityId}) between 1 and 120`,
    ),
    check(
      "learner_misconceptions_misconception_id_length",
      sql`length(${table.misconceptionId}) between 1 and 120`,
    ),
    check(
      "learner_misconceptions_times_encountered_positive",
      sql`${table.timesEncountered} >= 1`,
    ),
  ],
);

export type DiagnosticRunRow = typeof diagnosticRuns.$inferSelect;
export type DiagnosticResponseRow = typeof diagnosticResponses.$inferSelect;
export type AttemptRow = typeof attempts.$inferSelect;
export type LearnerCapabilityRow = typeof learnerCapabilities.$inferSelect;
export type LearnerMisconceptionRow =
  typeof learnerMisconceptions.$inferSelect;