CREATE TYPE "public"."project_item_type" AS ENUM('contract', 'payment', 'expense', 'memo');--> statement-breakpoint
CREATE TABLE "project_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"item_type" "project_item_type" NOT NULL,
	"source_sheet_name" text NOT NULL,
	"source_row_number" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"ordered_on" date,
	"partner_name" text,
	"description" text,
	"contract_amount" integer DEFAULT 0 NOT NULL,
	"received_amount" integer DEFAULT 0 NOT NULL,
	"spent_amount" integer DEFAULT 0 NOT NULL,
	"memo" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ordered_on" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "spent_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "profit_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_sheet_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_start_row" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_end_row" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_total_row" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_items_project_idx" ON "project_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_items_type_idx" ON "project_items" USING btree ("item_type");--> statement-breakpoint
CREATE UNIQUE INDEX "project_items_source_row_idx" ON "project_items" USING btree ("project_id","source_sheet_name","source_row_number");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_ordered_idx" ON "projects" USING btree ("ordered_on");--> statement-breakpoint
CREATE INDEX "projects_import_batch_idx" ON "projects" USING btree ("import_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_source_block_idx" ON "projects" USING btree ("source_sheet_name","source_start_row","source_total_row");