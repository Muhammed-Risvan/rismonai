ALTER TABLE "learner_capabilities" DROP CONSTRAINT "learner_capabilities_level_valid";--> statement-breakpoint
-- Data migration: the vocabulary is being split. The single old state
-- `developing` ("some evidence, not independent") becomes `practising`,
-- which now means exactly that. This MUST run after the DROP CONSTRAINT and
-- BEFORE the new CHECK is added, or existing rows would violate it.
UPDATE "learner_capabilities" SET "level" = 'practising' WHERE "level" = 'developing';--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD COLUMN "review_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "learner_capabilities_review_due_idx" ON "learner_capabilities" USING btree ("learner_id","review_at") WHERE "learner_capabilities"."review_at" is not null;--> statement-breakpoint
ALTER TABLE "learner_capabilities" ADD CONSTRAINT "learner_capabilities_level_valid" CHECK ("learner_capabilities"."level" in ('unknown','untested','introduced','practising','demonstrated','mastered','revision-needed'));