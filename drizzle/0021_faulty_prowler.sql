CREATE TABLE "project_schedule_status_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#2f70dc' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_schedule_status_options_label_idx" ON "project_schedule_status_options" USING btree ("label");--> statement-breakpoint
CREATE INDEX "project_schedule_status_options_sort_idx" ON "project_schedule_status_options" USING btree ("sort_order");