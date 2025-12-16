import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
};

const BASE_URL = __ENV.BASE_URL || 'https://app.zcr.ai';

export default function () {
  const payload = JSON.stringify({
    email: 'demo@zcr.ai',
    password: 'Demo@123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Note: Adjust endpoint path if necessary. Usually /api/auth/login
  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  
  check(res, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined || r.json('accessToken') !== undefined,
  });

  sleep(1);
}
