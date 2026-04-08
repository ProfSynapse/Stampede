// stampede/patterns/smoke.js
// Quick sanity check: 1-2 VUs for 30s.
// Validates that auth works and endpoints respond before scaling up.
//
// Env vars:
//   STAMPEDE_BASE_URL — Override profile's base URL
//
// Usage:
//   k6 run stampede/patterns/smoke.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import profile from '../profiles/target.js';
import { authenticate } from '../lib/auth.js';
import { trackResponse } from '../lib/metrics.js';

export const options = {
  vus: 2,
  duration: __ENV.STAMPEDE_DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate>0.95'],
  },
};

export function setup() {
  console.log(`[Stampede] Profile: ${profile.name}`);
  console.log(`[Stampede] Target: ${profile.baseUrl}`);
  console.log(`[Stampede] Pattern: smoke`);

  // Health check.
  if (profile.endpoints.health) {
    const health = http.get(`${profile.baseUrl}${profile.endpoints.health[0]}`);
    check(health, { 'target is up': (r) => r.status === 200 });
  }

  return {};
}

export default function () {
  const authState = authenticate(profile);

  // Hit each admin page.
  const pages = profile.endpoints.admin || profile.endpoints.public || [];
  for (const page of pages) {
    const start = Date.now();
    const res = http.get(`${profile.baseUrl}${page}`, {
      headers: authState.headers,
    });
    trackResponse(res, start);

    check(res, {
      [`${page} returned 200`]: (r) => r.status === 200,
    });
    sleep(1);
  }

  sleep(2);
}
