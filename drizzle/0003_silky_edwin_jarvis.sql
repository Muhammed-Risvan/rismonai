CREATE TABLE "learner_misconceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"capability_id" text NOT NULL,
	"misconception_id" text NOT NULL,
	"last_item_id" text NOT NULL,
	"times_encountered" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_misconceptions_capability_id_length" CHECK (length("learner_misconceptions"."capability_id") between 1 and 120),
	CONSTRAINT "learner_misconceptions_misconception_id_length" CHECK (length("learner_misconceptions"."misconception_id") between 1 and 120),
	CONSTRAINT "learner_misconceptions_times_encountered_positive" CHECK ("learner_misconceptions"."times_encountered" >= 1)
);
--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD COLUMN "mode" text DEFAULT 'independent' NOT NULL;--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD COLUMN "hints_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD COLUMN "misconception_id" text;--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD COLUMN "evidence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD COLUMN "assisted_pass" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD COLUMN "last_demonstrated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learner_misconceptions" ADD CONSTRAINT "learner_misconceptions_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learner_misconceptions_learner_id_idx" ON "learner_misconceptions" USING btree ("learner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learner_misconceptions_learner_id_misconception_id_key" ON "learner_misconceptions" USING btree ("learner_id","misconception_id");--> statement-breakpoint
CREATE INDEX "learner_misconceptions_open_idx" ON "learner_misconceptions" USING btree ("learner_id","capability_id") WHERE "learner_misconceptions"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "diagnostic_responses_misconception_id_idx" ON "diagnostic_responses" USING btree ("misconception_id");--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_mode_valid" CHECK ("diagnostic_responses"."mode" in ('guided','independent'));--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_hints_used_non_negative" CHECK ("diagnostic_responses"."hints_used" >= 0);--> statement-breakpoint
ALTER TABLE "diagnostic_responses" ADD CONSTRAINT "diagnostic_responses_misconception_implies_incorrect" CHECK ("diagnostic_responses"."misconception_id" is null or "diagnostic_responses"."correct" = false);--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD CONSTRAINT "learner_capabilities_evidence_count_non_negative" CHECK ("learner_capabilities"."evidence_count" >= 0);--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD CONSTRAINT "learner_capabilities_mastered_requires_evidence" CHECK ("learner_capabilities"."level" <> 'mastered' or "learner_capabilities"."evidence_count" > 0);--> statement-breakpoint
-- Lock Supabase's auto-generated Data API out of the new table, for the same
-- reason as 0000/0001/0002: RLS with no policies denies all access to
-- non-owner roles, and the REVOKE removes table privileges from the public API
-- roles. The app touches this table only through the server-side Drizzle
-- connection (owner role), which is unaffected. Hand-written, because Drizzle
-- cannot express RLS/GRANTs (precedent: 0000/0001/0002).
ALTER TABLE "learner_misconceptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "learner_misconceptions" FROM anon, authenticated;