import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must be < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  const payload = JSON.stringify({
    email: 'superadmin@zcr.ai',
    password: 'SuperAdmin@123!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/auth/login`, payload, params);

  const checkRes = check(res, {
    'is status 200': (r) => r.status === 200,
    'has token': (r) => r.json('success') === true,
  });

  if (!checkRes) {
      console.log(`Request failed: ${res.status} ${res.body}`);
  }

  sleep(1);
}
