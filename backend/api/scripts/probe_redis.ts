import Redis from 'ioredis';

const passwords = ['', 'redis', 'password', 'admin', '123456', 'root', 'zcrai'];

async function probe() {
    for (const pass of passwords) {
        console.log(`Trying password: '${pass}'...`);
        const redis = new Redis({
            port: 6379,
            host: 'localhost',
            password: pass || undefined,
            showFriendlyErrorStack: false,
            retryStrategy: () => null // Don't retry
        });

        try {
            await redis.ping();
            console.log(`✅ Success! Password is: '${pass}'`);
            redis.disconnect();
            process.exit(0);
        } catch (e: any) {
            console.log(`❌ Failed: ${e.message}`);
            redis.disconnect();
        }
    }
    console.log('❌ All attempts failed.');
    process.exit(1);
}

probe();
