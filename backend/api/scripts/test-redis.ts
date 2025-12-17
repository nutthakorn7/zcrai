import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://:redis_password@localhost:6379';
console.log('Testing Redis connection to:', redisUrl.replace(/:[^:@]*@/, ':****@'));

const redis = new Redis(redisUrl, {
  connectTimeout: 5000,
  lazyConnect: true
});

async function test() {
  try {
    await redis.connect();
    console.log('✅ Connected');
    const response = await redis.ping();
    console.log('✅ PING response:', response);
    await redis.quit();
  } catch (e: any) {
    console.error('❌ Redis Connection Failed:', e.message);
    process.exit(1);
  }
}

test();
