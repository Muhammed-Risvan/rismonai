CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"capability_id" text NOT NULL,
	"item_id" text NOT NULL,
	"response" text NOT NULL,
	"correct" boolean NOT NULL,
	"mode" text DEFAULT 'independent' NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"misconception_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_capability_id_length" CHECK (length("attempts"."capability_id") between 1 and 120),
	CONSTRAINT "attempts_item_id_length" CHECK (length("attempts"."item_id") between 1 and 120),
	CONSTRAINT "attempts_response_length" CHECK (length("attempts"."response") between 1 and 500),
	CONSTRAINT "attempts_mode_valid" CHECK ("attempts"."mode" in ('guided','independent')),
	CONSTRAINT "attempts_hints_used_non_negative" CHECK ("attempts"."hints_used" >= 0),
	CONSTRAINT "attempts_independent_implies_no_hints" CHECK ("attempts"."mode" <> 'independent' or "attempts"."hints_used" = 0),
	CONSTRAINT "attempts_misconception_implies_incorrect" CHECK ("attempts"."misconception_id" is null or "attempts"."correct" = false)
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_learner_id_learner_profiles_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_learner_id_idx" ON "attempts" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "attempts_learner_capability_idx" ON "attempts" USING btree ("learner_id","capability_id","created_at");--> statement-breakpoint
CREATE INDEX "attempts_misconception_id_idx" ON "attempts" USING btree ("misconception_id");--> statement-breakpoint
-- Lock Supabase's auto-generated Data API out of `attempts`, for the same
-- reason as 0000/0001/0002/0003: RLS with no policies denies all access to
-- non-owner roles, and the REVOKE removes table privileges from the public API
-- roles. The app touches this table only through the server-side Drizzle
-- connection (owner role), which is unaffected. Hand-written, because Drizzle
-- cannot express RLS/GRANTs (precedent: 0000-0003).
--
-- `attempts` holds raw learner answers, so this table is exactly the kind that
-- must never become readable through the anon or authenticated API roles.
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "attempts" FROM anon, authenticated;