ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_sync_status" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_sync_error" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_sync_at" timestamp;