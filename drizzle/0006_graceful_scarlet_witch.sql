CREATE TYPE "public"."employee_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('previewed', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'employee' BEFORE 'manager';--> statement-breakpoint
CREATE TABLE "bank_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_date" date,
	"title" text NOT NULL,
	"account_name" text,
	"income_amount" integer DEFAULT 0 NOT NULL,
	"expense_amount" integer DEFAULT 0 NOT NULL,
	"balance_amount" integer DEFAULT 0 NOT NULL,
	"memo" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transacted_on" date,
	"bank_name" text,
	"account_number" text,
	"description" text,
	"deposit_amount" integer DEFAULT 0 NOT NULL,
	"withdrawal_amount" integer DEFAULT 0 NOT NULL,
	"balance_amount" integer DEFAULT 0 NOT NULL,
	"category" text,
	"memo" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" text,
	"name" text NOT NULL,
	"position" text,
	"department" text,
	"payroll_bank_account" text,
	"user_id" uuid,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"target_table" text,
	"target_id" uuid,
	"sheet_name" text NOT NULL,
	"source_row_number" integer DEFAULT 0 NOT NULL,
	"source_cell_range" text,
	"status" text DEFAULT 'imported' NOT NULL,
	"error_message" text,
	"raw_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"menu_key" text NOT NULL,
	"can_view" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_update" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_upload" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_slip_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"label" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"employee_code" text,
	"employee_name" text NOT NULL,
	"position" text,
	"payroll_month" text NOT NULL,
	"payroll_bank_account" text,
	"gross_pay" integer DEFAULT 0 NOT NULL,
	"total_deduction" integer DEFAULT 0 NOT NULL,
	"net_pay" integer DEFAULT 0 NOT NULL,
	"source_sheet_name" text NOT NULL,
	"source_block" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" text,
	"project_name" text NOT NULL,
	"client_name" text,
	"manager_name" text,
	"status" text,
	"started_on" date,
	"ended_on" date,
	"contract_amount" integer DEFAULT 0 NOT NULL,
	"received_amount" integer DEFAULT 0 NOT NULL,
	"memo" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issued_on" date,
	"direction" text DEFAULT 'sales' NOT NULL,
	"project_name" text,
	"partner_name" text,
	"item_name" text,
	"supply_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"status" text,
	"memo" text,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_users" ALTER COLUMN "role" SET DEFAULT 'employee';--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "import_type" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "detected_type" text;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "status" "import_status" DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "success_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "error_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "result_summary" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payroll_slip_id_payroll_slips_id_fk" FOREIGN KEY ("payroll_slip_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_ledgers_date_idx" ON "bank_ledgers" USING btree ("ledger_date");--> statement-breakpoint
CREATE INDEX "bank_ledgers_title_idx" ON "bank_ledgers" USING btree ("title");--> statement-breakpoint
CREATE INDEX "bank_transactions_date_idx" ON "bank_transactions" USING btree ("transacted_on");--> statement-breakpoint
CREATE INDEX "bank_transactions_description_idx" ON "bank_transactions" USING btree ("description");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_employee_code_idx" ON "employees" USING btree ("employee_code");--> statement-breakpoint
CREATE INDEX "employees_user_idx" ON "employees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employees_name_idx" ON "employees" USING btree ("name");--> statement-breakpoint
CREATE INDEX "import_rows_batch_idx" ON "import_rows" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "import_rows_target_idx" ON "import_rows" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_permissions_role_menu_idx" ON "menu_permissions" USING btree ("role","menu_key");--> statement-breakpoint
CREATE INDEX "menu_permissions_menu_idx" ON "menu_permissions" USING btree ("menu_key");--> statement-breakpoint
CREATE INDEX "payroll_items_slip_idx" ON "payroll_items" USING btree ("payroll_slip_id");--> statement-breakpoint
CREATE INDEX "payroll_items_type_idx" ON "payroll_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "payroll_slips_employee_idx" ON "payroll_slips" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "payroll_slips_month_idx" ON "payroll_slips" USING btree ("payroll_month");--> statement-breakpoint
CREATE INDEX "payroll_slips_employee_month_idx" ON "payroll_slips" USING btree ("employee_name","payroll_month");--> statement-breakpoint
CREATE INDEX "projects_name_idx" ON "projects" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_invoices_issued_idx" ON "tax_invoices" USING btree ("issued_on");--> statement-breakpoint
CREATE INDEX "tax_invoices_partner_idx" ON "tax_invoices" USING btree ("partner_name");