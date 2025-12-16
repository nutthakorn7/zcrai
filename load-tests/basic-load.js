import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],   // <1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://app.zcr.ai';

export default function () {
  // Test public endpoint or health check
  let res = http.get(`${BASE_URL}/health`); 
  // If health endpoint doesn't exist, we might get 404, so maybe use root /
  if (res.status === 404) {
      res = http.get(`${BASE_URL}/`);
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
