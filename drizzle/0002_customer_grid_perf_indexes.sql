CREATE INDEX IF NOT EXISTS "customers_assigned_updated_id_desc_idx" ON "customers" USING btree ("assigned_user_id","updated_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_assigned_source_updated_idx" ON "customers" USING btree ("assigned_user_id","source","updated_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_assigned_status_updated_idx" ON "customers" USING btree ("assigned_user_id","status","updated_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_assigned_gender_updated_idx" ON "customers" USING btree ("assigned_user_id","gender","updated_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_assigned_age_updated_idx" ON "customers" USING btree ("assigned_user_id","age_decade","updated_at" DESC,"id" DESC);
