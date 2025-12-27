CREATE TABLE "ai_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"alert_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"content" text NOT NULL,
	"vector" vector(768),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learned_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"pattern_type" text DEFAULT 'title' NOT NULL,
	"confidence" integer DEFAULT 100,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'auto_learning',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soar_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid,
	"alert_id" uuid,
	"action_type" text NOT NULL,
	"provider" text NOT NULL,
	"target" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"triggered_by" text DEFAULT 'ai' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "resource" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "observables" ALTER COLUMN "sighting_count" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "observables" ALTER COLUMN "sighting_count" SET DEFAULT '1';--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "dismiss_reason" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "promoted_case_id" uuid;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "user_feedback" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "feedback_reason" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "feedback_by" uuid;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "feedback_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "health_status" text DEFAULT 'healthy';--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "failure_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_healthy_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "is_circuit_open" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "token_expiry_alert_sent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "resource_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "status" text DEFAULT 'SUCCESS';--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "observables" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "playbook_steps" ADD COLUMN "position_x" integer;--> statement-breakpoint
ALTER TABLE "playbook_steps" ADD COLUMN "position_y" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "autopilot_mode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "autopilot_threshold" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_embeddings" ADD CONSTRAINT "alert_embeddings_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_embeddings" ADD CONSTRAINT "alert_embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learned_patterns" ADD CONSTRAINT "learned_patterns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soar_actions" ADD CONSTRAINT "soar_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soar_actions" ADD CONSTRAINT "soar_actions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soar_actions" ADD CONSTRAINT "soar_actions_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soar_actions" ADD CONSTRAINT "soar_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_promoted_case_id_cases_id_fk" FOREIGN KEY ("promoted_case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_feedback_by_users_id_fk" FOREIGN KEY ("feedback_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");