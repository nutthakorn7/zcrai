import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
    try {
        console.log("Dropping system_config table...");
        await sql`DROP TABLE IF EXISTS system_config`;
        console.log("Dropped system_config.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
