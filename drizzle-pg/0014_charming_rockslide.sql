CREATE TABLE "baidu_submission_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"site" text NOT NULL,
	"status" text NOT NULL,
	"remaining" integer,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"response_sha256" text NOT NULL,
	"error_message" text,
	"submitted_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baidu_submission_urls" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "china_seo_rank_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"keyword" text NOT NULL,
	"target_domain" text NOT NULL,
	"location_code" integer DEFAULT 2156 NOT NULL,
	"language_code" text DEFAULT 'zh_CN' NOT NULL,
	"device" text NOT NULL,
	"position" integer,
	"ranking_url" text,
	"serp_features" text,
	"upstream_task_id" text,
	"response_sha256" text NOT NULL,
	"checked_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_evidence_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"evidence_id" text NOT NULL,
	"provider" text NOT NULL,
	"evidence_class" text NOT NULL,
	"channel" text NOT NULL,
	"prompt" text NOT NULL,
	"answer" text NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"content_sha256" text NOT NULL,
	"captured_at" text NOT NULL,
	"imported_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baidu_submission_batches" ADD CONSTRAINT "baidu_submission_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baidu_submission_urls" ADD CONSTRAINT "baidu_submission_urls_batch_id_baidu_submission_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."baidu_submission_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "china_seo_rank_checks" ADD CONSTRAINT "china_seo_rank_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_evidence_imports" ADD CONSTRAINT "geo_evidence_imports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "baidu_submission_batches_project_submitted_idx" ON "baidu_submission_batches" USING btree ("project_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "baidu_submission_urls_batch_url_idx" ON "baidu_submission_urls" USING btree ("batch_id","url");--> statement-breakpoint
CREATE INDEX "china_seo_rank_checks_project_checked_idx" ON "china_seo_rank_checks" USING btree ("project_id","checked_at");--> statement-breakpoint
CREATE INDEX "china_seo_rank_checks_keyword_idx" ON "china_seo_rank_checks" USING btree ("project_id","keyword","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_evidence_imports_project_evidence_idx" ON "geo_evidence_imports" USING btree ("project_id","evidence_id");--> statement-breakpoint
CREATE INDEX "geo_evidence_imports_project_captured_idx" ON "geo_evidence_imports" USING btree ("project_id","captured_at");