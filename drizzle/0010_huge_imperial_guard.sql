ALTER TABLE "calendar_events" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "end_date" date;--> statement-breakpoint
UPDATE "calendar_events" SET "start_date" = "event_date", "end_date" = "event_date";--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "start_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "end_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "all_day" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "attendees" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "calendar_events_range_idx" ON "calendar_events" USING btree ("start_date","end_date");
