import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

async function patchSchema() {
    console.log('🔧 Patching Schema manually...');
    try {
        await db.execute(sql`ALTER TABLE detection_rules ADD COLUMN IF NOT EXISTS mitre_tactic text;`);
        await db.execute(sql`ALTER TABLE detection_rules ADD COLUMN IF NOT EXISTS mitre_technique text;`);
        console.log('✅ Schema patched successfully.');
    } catch (e: any) {
        console.error('❌ Schema patch failed:', e.message);
    }
}

if (import.meta.main) {
    patchSchema()
        .then(() => process.exit(0))
        .catch(console.error);
}
