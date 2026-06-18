ALTER TABLE "work_diary_types" ADD COLUMN "color" text DEFAULT '#475569' NOT NULL;--> statement-breakpoint
UPDATE "work_diary_types"
SET "color" = CASE "code"
	WHEN 'TRIP' THEN '#2563eb'
	WHEN 'WORK' THEN '#475569'
	WHEN 'VACATION' THEN '#dc2626'
	WHEN 'AM_VACATION' THEN '#9333ea'
	WHEN 'PM_VACATION' THEN '#be123c'
	ELSE "color"
END;
