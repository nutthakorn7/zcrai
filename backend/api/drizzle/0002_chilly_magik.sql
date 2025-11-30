CREATE TABLE "collector_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"url_hash" text NOT NULL,
	"checkpoint" timestamp,
	"full_sync_at" timestamp,
	"full_sync_complete" boolean DEFAULT false NOT NULL,
	"event_count" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collector_states" ADD CONSTRAINT "collector_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;