import { query } from '../infra/clickhouse/client';

async function checkSchema() {
    console.log('🔍 Checking ClickHouse Schema for security_events...');
    try {
        const result = await query('DESCRIBE security_events');
        console.log(result);
    } catch (e: any) {
        console.error('❌ Failed to describe table:', e.message);
    }
}

if (import.meta.main) {
    checkSchema()
        .then(() => process.exit(0))
        .catch(console.error);
}
