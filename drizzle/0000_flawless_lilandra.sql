CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_outcome" text,
	"status" text NOT NULL,
	"deadline" date,
	"hours_per_week" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_title_length" CHECK (length("goals"."title") between 1 and 200),
	CONSTRAINT "goals_description_max_length" CHECK (length("goals"."description") <= 2000),
	CONSTRAINT "goals_target_outcome_max_length" CHECK (length("goals"."target_outcome") <= 500),
	CONSTRAINT "goals_status_valid" CHECK ("goals"."status" in ('active','paused','archived','completed')),
	CONSTRAINT "goals_hours_per_week_range" CHECK ("goals"."hours_per_week" between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "learner_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_profiles_display_name_max_length" CHECK (length("learner_profiles"."display_name") <= 80)
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_learner_id_idx" ON "goals" USING btree ("learner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_active_per_learner" ON "goals" USING btree ("learner_id") WHERE status = 'active';--> statement-breakpoint
-- The profile id IS the Supabase Auth user id. Drizzle cannot express a
-- reference into Supabase's auth schema, so this FK is hand-written here.
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_id_auth_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Lock Supabase's auto-generated Data API out of learner data entirely:
-- RLS with no policies denies all access to non-owner roles, and the REVOKE
-- removes any table privilege from the public API roles. The app talks to
-- these tables only through the server-side Drizzle connection (owner role),
-- which is unaffected. Hand-written (Drizzle cannot express RLS/GRANTs).
ALTER TABLE "learner_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "learner_profiles" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "goals" FROM anon, authenticated;