CREATE TABLE "whiteboard_states" (
	"id" text PRIMARY KEY NOT NULL,
	"text_content" text DEFAULT '' NOT NULL,
	"canvas_data_url" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whiteboard_states" ADD CONSTRAINT "whiteboard_states_updated_by_app_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;