ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sales_potential" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_sales_potential_idx" ON "customers" USING btree ("sales_potential");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_assigned_sales_potential_updated_idx" ON "customers" USING btree ("assigned_user_id","sales_potential","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);
