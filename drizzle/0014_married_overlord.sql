CREATE TABLE "work_diary_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_diary_entries" ADD COLUMN "work_type_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "work_diary_types_code_idx" ON "work_diary_types" USING btree ("code");--> statement-breakpoint
INSERT INTO "work_diary_types" ("code", "label", "sort_order")
VALUES
	('TRIP', '출장', 0),
	('WORK', '업무', 1),
	('VACATION', '휴가', 2),
	('AM_VACATION', '오전휴가', 3),
	('PM_VACATION', '오후휴가', 4)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
UPDATE "work_diary_entries" AS entry
SET "work_type_id" = type_option."id"
FROM "work_diary_types" AS type_option
WHERE entry."work_type_id" IS NULL
  AND type_option."code" = CASE entry."work_type"
	WHEN '출장' THEN 'TRIP'
	WHEN '휴가' THEN 'VACATION'
	WHEN '오전휴가' THEN 'AM_VACATION'
	WHEN '오후휴가' THEN 'PM_VACATION'
	ELSE 'WORK'
  END;
--> statement-breakpoint
CREATE INDEX "work_diary_types_active_sort_idx" ON "work_diary_types" USING btree ("is_active","sort_order");--> statement-breakpoint
ALTER TABLE "work_diary_entries" ADD CONSTRAINT "work_diary_entries_work_type_id_work_diary_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "public"."work_diary_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_diary_entries_type_idx" ON "work_diary_entries" USING btree ("work_type_id");
