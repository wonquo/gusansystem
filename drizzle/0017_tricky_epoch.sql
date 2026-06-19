WITH ranked_work_diary_entries AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "user_id", "work_date"
      ORDER BY
        (
          CASE WHEN nullif(btrim("primary_work"), '') IS NULL THEN 0 ELSE 1 END +
          CASE WHEN nullif(btrim("secondary_work"), '') IS NULL THEN 0 ELSE 1 END +
          CASE WHEN nullif(btrim("memo"), '') IS NULL THEN 0 ELSE 1 END +
          CASE WHEN "destination_id" IS NULL THEN 0 ELSE 1 END +
          CASE WHEN "work_type_id" IS NULL THEN 0 ELSE 1 END
        ) DESC,
        "updated_at" DESC,
        "created_at" DESC,
        "id" DESC
    ) AS row_rank
  FROM "work_diary_entries"
)
DELETE FROM "work_diary_entries"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_work_diary_entries
  WHERE row_rank > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX "work_diary_entries_user_date_unique_idx" ON "work_diary_entries" USING btree ("user_id","work_date");
