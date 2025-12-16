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
