ALTER TABLE "app_users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "app_users" ALTER COLUMN "role" SET DEFAULT 'employee'::text;--> statement-breakpoint
ALTER TABLE "menu_permissions" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "app_users" SET "role" = 'employee' WHERE "role" IN ('manager', 'agent');--> statement-breakpoint
DELETE FROM "menu_permissions" WHERE "role" IN ('manager', 'agent');--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'employee');--> statement-breakpoint
ALTER TABLE "app_users" ALTER COLUMN "role" SET DEFAULT 'employee'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "app_users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "menu_permissions" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";
