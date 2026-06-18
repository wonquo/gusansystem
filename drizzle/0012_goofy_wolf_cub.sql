CREATE TABLE "work_diary_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"primary_work" text DEFAULT '' NOT NULL,
	"secondary_work" text DEFAULT '' NOT NULL,
	"destination_id" uuid,
	"memo" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_diary_entries" ADD CONSTRAINT "work_diary_entries_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_diary_entries" ADD CONSTRAINT "work_diary_entries_destination_id_work_diary_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."work_diary_destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_diary_destinations_code_idx" ON "work_diary_destinations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "work_diary_destinations_active_sort_idx" ON "work_diary_destinations" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "work_diary_entries_user_date_idx" ON "work_diary_entries" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "work_diary_entries_date_idx" ON "work_diary_entries" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "work_diary_entries_destination_idx" ON "work_diary_entries" USING btree ("destination_id");--> statement-breakpoint
INSERT INTO "work_diary_destinations" ("code", "label", "sort_order")
VALUES ('OFFICE', '사무실', 0)
ON CONFLICT ("code") DO NOTHING;
