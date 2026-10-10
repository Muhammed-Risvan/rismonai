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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("goals_learner_id_idx").on(table.learnerId),
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

export type LearnerProfileRow = typeof learnerProfiles.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;