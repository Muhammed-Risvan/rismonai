CREATE TABLE "diagnostic_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"capability_id" text NOT NULL,
	"response" text NOT NULL,
	"correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagnostic_responses_item_id_length" CHECK (length("diagnostic_responses"."item_id") between 1 and 120),
	CONSTRAINT "diagnostic_responses_capability_id_length" CHECK (length("diagnostic_responses"."capability_id") between 1 and 120),
	CONSTRAINT "diagnostic_responses_response_length" CHECK (length("diagnostic_responses"."response") between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "diagnostic_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"goal_id" uuid,
	"ambition_id" text NOT NULL,
	"content_version" text NOT NULL,
	"item_ids" text[] NOT NULL,
	"items_snapshot" jsonb NOT NULL,
	"required_capability_ids" text[] NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "diagnostic_runs_status_valid" CHECK ("diagnostic_runs"."status" in ('in_progress','complete','opted_out')),
	CONSTRAINT "diagnostic_runs_content_version_semver" CHECK ("diagnostic_runs"."content_version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "learner_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"capability_id" text NOT NULL,
	"level" text NOT NULL,
	"source" text NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_capabilities_capability_id_length" CHECK (length("learner_capabilities"."capability_id") between 1 and 120),
	CONSTRAINT "learner_capabilities_level_valid" CHECK ("learner_capabilities"."level" in ('unknown','untested','developing','mastered','revision-needed')),
	CONSTRAINT "learner_capabilities_source_valid" CHECK ("learner_capabilities"."source" in ('diagnostic','opt-out'))
);
--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_run_id_diagnostic_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."diagnostic_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_runs" ADD CONSTRAINT "diagnostic_runs_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_runs" ADD CONSTRAINT "diagnostic_runs_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_runs" ADD CONSTRAINT "diagnostic_runs_ambition_id_ambitions_id_fk" FOREIGN KEY ("ambition_id") REFERENCES "public"."ambitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD CONSTRAINT "learner_capabilities_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD CONSTRAINT "learner_capabilities_run_id_diagnostic_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."diagnostic_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diagnostic_responses_run_id_idx" ON "diagnostic_responses" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "diagnostic_responses_learner_id_idx" ON "diagnostic_responses" USING btree ("learner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diagnostic_responses_run_id_item_id_key" ON "diagnostic_responses" USING btree ("run_id","item_id");--> statement-breakpoint
CREATE INDEX "diagnostic_runs_learner_id_idx" ON "diagnostic_runs" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "diagnostic_runs_goal_id_idx" ON "diagnostic_runs" USING btree ("goal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diagnostic_runs_id_learner_id_key" ON "diagnostic_runs" USING btree ("id","learner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diagnostic_runs_one_in_progress_per_learner_ambition" ON "diagnostic_runs" USING btree ("learner_id","ambition_id") WHERE status = 'in_progress';--> statement-breakpoint
CREATE INDEX "learner_capabilities_learner_id_idx" ON "learner_capabilities" USING btree ("learner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learner_capabilities_learner_id_capability_id_key" ON "learner_capabilities" USING btree ("learner_id","capability_id");--> statement-breakpoint
-- Composite FK: a response's (run_id, learner_id) pair must match its run.
-- Drizzle cannot express composite foreign keys, so this is hand-written
-- (precedent: the auth.users FK in 0000). Defense-in-depth alongside the
-- service layer's learnerId scoping: cross-learner inserts fail at the DB.
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_run_learner_fk" FOREIGN KEY ("run_id","learner_id") REFERENCES "public"."diagnostic_runs"("id","learner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Lock Supabase's auto-generated Data API out of the diagnostic tables, for
-- the same reason as 0000/0001: RLS with no policies denies all access to
-- non-owner roles, and the REVOKE removes table privileges from the public
-- API roles. The app reads/writes these tables only through the server-side
-- Drizzle connection (owner role), which is unaffected. Hand-written
-- (Drizzle cannot express RLS/GRANTs).
ALTER TABLE "diagnostic_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "learner_capabilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "diagnostic_runs" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "diagnostic_responses" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "learner_capabilities" FROM anon, authenticated;