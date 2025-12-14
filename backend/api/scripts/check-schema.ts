import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5432/zcrai';
const sql = postgres(connectionString);

async function checkSchema() {
  console.log('🔍 Checking alerts table columns...\n');

  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'alerts' 
      ORDER BY ordinal_position
    `;
    
    console.log('Current alerts columns:');
    columns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✅ Schema check complete');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

checkSchema();
