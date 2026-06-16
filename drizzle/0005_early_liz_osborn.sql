CREATE TABLE "notice_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"popup_enabled" boolean DEFAULT false NOT NULL,
	"popup_starts_at" timestamp with time zone,
	"popup_ends_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_comments" ADD CONSTRAINT "notice_comments_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notice_comments_notice_idx" ON "notice_comments" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "notice_comments_created_idx" ON "notice_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notices_pinned_created_idx" ON "notices" USING btree ("is_pinned","created_at");--> statement-breakpoint
CREATE INDEX "notices_popup_idx" ON "notices" USING btree ("popup_enabled","popup_starts_at","popup_ends_at");