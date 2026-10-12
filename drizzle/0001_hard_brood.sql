CREATE TABLE "ambitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"target_outcome" text NOT NULL,
	"level" text DEFAULT 'beginner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ambitions_level_valid" CHECK ("ambitions"."level" in ('beginner','intermediate','advanced')),
	CONSTRAINT "ambitions_name_length" CHECK (length("ambitions"."name") between 1 and 120),
	CONSTRAINT "ambitions_target_outcome_max_length" CHECK (length("ambitions"."target_outcome") <= 500)
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "ambition_id" text;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_ambition_id_ambitions_id_fk" FOREIGN KEY ("ambition_id") REFERENCES "public"."ambitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_ambition_id_idx" ON "goals" USING btree ("ambition_id");--> statement-breakpoint
-- Lock Supabase's auto-generated Data API out of the ambitions catalog too, for
-- the same reason as 0000: RLS with no policies denies all access to non-owner
-- roles, and the REVOKE removes table privileges from the public API roles. The
-- app reads/writes this table only through the server-side Drizzle connection
-- (owner role), which is unaffected. Hand-written (Drizzle cannot express
-- RLS/GRANTs). ambitions is reference/catalog data, not learner-owned, but it is
-- still locked down so the Data API cannot expose or mutate it.
ALTER TABLE "ambitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "ambitions" FROM anon, authenticated;