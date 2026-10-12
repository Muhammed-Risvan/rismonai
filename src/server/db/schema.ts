import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
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