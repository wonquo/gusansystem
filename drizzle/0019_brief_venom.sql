CREATE TYPE "public"."project_schedule_type" AS ENUM('main', 'sub');--> statement-breakpoint
CREATE TABLE "project_schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_schedule_id" uuid NOT NULL,
	"schedule_date" date,
	"schedule_text" text NOT NULL,
	"task_description" text,
	"manager_name" text,
	"status" text,
	"memo" text,
	"source_line_number" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type" "project_schedule_type" NOT NULL,
	"project_code" text,
	"project_name" text NOT NULL,
	"task_description" text,
	"destination_name" text,
	"control_manager_name" text,
	"facility_manager_name" text,
	"manager_name" text,
	"project_month" text,
	"status" text,
	"expense_memo" text,
	"expense_amount" integer DEFAULT 0 NOT NULL,
	"memo" text,
	"source_sheet_name" text,
	"source_row_number" integer,
	"source_section" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_schedule_items" ADD CONSTRAINT "project_schedule_items_project_schedule_id_project_schedules_id_fk" FOREIGN KEY ("project_schedule_id") REFERENCES "public"."project_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_schedule_items_project_idx" ON "project_schedule_items" USING btree ("project_schedule_id");--> statement-breakpoint
CREATE INDEX "project_schedule_items_date_idx" ON "project_schedule_items" USING btree ("schedule_date");--> statement-breakpoint
CREATE INDEX "project_schedule_items_status_idx" ON "project_schedule_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_schedules_type_idx" ON "project_schedules" USING btree ("project_type");--> statement-breakpoint
CREATE INDEX "project_schedules_code_idx" ON "project_schedules" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "project_schedules_name_idx" ON "project_schedules" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "project_schedules_status_idx" ON "project_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_schedules_month_idx" ON "project_schedules" USING btree ("project_month");--> statement-breakpoint
CREATE INDEX "project_schedules_updated_idx" ON "project_schedules" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_schedules_source_row_idx" ON "project_schedules" USING btree ("source_sheet_name","source_row_number");