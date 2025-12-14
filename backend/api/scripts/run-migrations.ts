import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

// Use DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5432/zcrai';
const sql = postgres(connectionString);

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  try {
    // Migration 1: Alert Deduplication
    console.log('📝 Running: 001_add_alert_deduplication.sql');
    const migration1 = readFileSync(
      join(__dirname, '../infra/db/migrations/001_add_alert_deduplication.sql'),
      'utf-8'
    );
    await sql.unsafe(migration1);
    console.log('✅ Alert deduplication fields added\n');

    // Migration 2: Notification Channels
    console.log('📝 Running: 002_add_notification_channels.sql');
    const migration2 = readFileSync(
      join(__dirname, '../infra/db/migrations/002_add_notification_channels.sql'),
      'utf-8'
    );
    await sql.unsafe(migration2);
    console.log('✅ Notification channels table created\n');

    console.log('🎉 All migrations completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some tables/columns already exist - this is OK');
    } else {
      throw error;
    }
  } finally {
    await sql.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
