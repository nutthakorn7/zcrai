import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Manual .env parser
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
} catch (e) {
    console.warn("Could not load .env file", e);
}

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);

async function main() {
    try {
        console.log("Creating tables...");
        
        // Approvals
        await sql`CREATE TABLE IF NOT EXISTS "approvals" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "tenant_id" uuid NOT NULL,
            "execution_id" uuid NOT NULL,
            "step_id" uuid NOT NULL,
            "status" text DEFAULT 'pending' NOT NULL,
            "requested_at" timestamp DEFAULT now() NOT NULL,
            "acted_by" uuid,
            "acted_at" timestamp,
            "comments" text
        )`;
        console.log("Created approvals table.");

        // Playbook Inputs
        await sql`CREATE TABLE IF NOT EXISTS "playbook_inputs" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "tenant_id" uuid NOT NULL,
            "execution_id" uuid NOT NULL,
            "step_id" uuid NOT NULL,
            "input_schema" jsonb NOT NULL,
            "input_data" jsonb,
            "status" text DEFAULT 'pending' NOT NULL,
            "requested_at" timestamp DEFAULT now() NOT NULL,
            "responded_by" uuid,
            "responded_at" timestamp
        )`;
        console.log("Created playbook_inputs table.");

        // System Config
        await sql`CREATE TABLE IF NOT EXISTS "system_config" (
            "key" text PRIMARY KEY NOT NULL,
            "value" text NOT NULL,
            "description" text,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )`;
        console.log("Created system_config table.");

        // Subscriptions
        await sql`CREATE TABLE IF NOT EXISTS "subscriptions" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "tenant_id" uuid NOT NULL,
            "tier" text DEFAULT 'free' NOT NULL,
            "status" text DEFAULT 'active' NOT NULL,
            "current_period_end" timestamp,
            "stripe_customer_id" text,
            "stripe_subscription_id" text,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )`;
        console.log("Created subscriptions table.");

        // FKs (Try/Catch individually as they might exist)
        const runSafe = async (q) => {
            try { await q; } catch (e) { console.log("Skipping FK/Constraint:", e.message); }
        };

        await runSafe(sql`ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action`);
        
        console.log("Migration complete.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
