
import { redis } from '../infra/cache/redis';

async function testRedis() {
  console.log('🔄 Testing Redis from App Config...');
  console.log('Redis status:', redis.status);
  
  try {
    const key = 'test_config_key';
    const val = 'test_value';
    await redis.set(key, val, 'EX', 60);
    const result = await redis.get(key);
    console.log('✅ Redis Get Result:', result);
    
    if (result === val) {
        console.log('🎉 Redis connection working!');
    } else {
        console.error('❌ Value mismatch!');
    }
  } catch (error) {
    console.error('❌ Redis Operation Failed:', error);
  } finally {
    redis.disconnect();
  }
}

testRedis();
