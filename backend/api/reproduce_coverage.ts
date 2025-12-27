
import { app } from './index';
import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';

async function test() {
  console.log('--- Starting Coverage Mode Test ---');

  const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key';
  
  // Create a temporary signer app
  const signer = new Elysia()
    .use(jwt({
      name: 'jwt',
      secret: JWT_SECRET
    }))
    .get('/sign', async ({ jwt }) => {
      return await jwt.sign({
        id: 'super-admin-id',
        role: 'superadmin',
        email: 'superadmin@zcr.ai'
        // tenantId omitted
      })
    });

  const token = await signer.handle(new Request('http://localhost/sign')).then(r => r.text());
  console.log('Generated Token:', token.substring(0, 10) + '...');

  // URL matching Nginx log: mode=coverage
  const url = 'http://localhost:8000/dashboard/mitre-heatmap?startDate=2025-11-17T13:13:07.191Z&endDate=2025-12-17T13:13:07.191Z&mode=coverage';
  console.log(`Fetching: ${url}`);
  
  const response = await app.handle(
    new Request(url, {
      headers: {
        'Cookie': `access_token=${token}`,
        'Content-Type': 'application/json'
      }
    })
  );

  console.log(`Status: ${response.status} ${response.statusText}`);
  const text = await response.text();
  console.log('Body:', text);

  if (response.status === 200) {
    console.log('✅ SUCCESS');
  } else {
    console.log('❌ FAILURE');
  }
  process.exit(0);
}

test().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
