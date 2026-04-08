// stampede/patterns/stress.js
// Ramping sustained load: gradually increase VUs to find degradation point.
// Uses form-login auth to browse authenticated pages.
//
// Ramp pattern:
//   1. Warm up: 10 VUs for 1 minute
//   2. Ramp: 50 VUs for 3 minutes
//   3. Push: 100 VUs for 3 minutes
//   4. Stress: 200 VUs for 3 minutes
//   5. Cool down: 0 VUs over 1 minute
//
// Env vars:
//   STAMPEDE_MAX_VUS  — Peak VU count (default: 200)
//   STAMPEDE_DURATION — Duration of each ramp stage (default: 3m)
//
// Usage:
//   k6 run stampede/patterns/stress.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import profile from '../profiles/target.js';
import { authenticate } from '../lib/auth.js';
import { trackResponse } from '../lib/metrics.js';

const pageLoadTime = new Trend('page_load_time');
const maxVus = parseInt(__ENV.STAMPEDE_MAX_VUS || '200');
const stageDuration = __ENV.STAMPEDE_DURATION || '3m';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.ceil(maxVus * 0.05) },   // warm up
        { duration: stageDuration, target: Math.ceil(maxVus * 0.25) },  // ramp
        { duration: stageDuration, target: Math.ceil(maxVus * 0.5) },   // push
        { duration: stageDuration, target: maxVus },                     // stress
        { duration: '1m', target: 0 },                                   // cool down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
    page_load_time: ['p(95)<4000'],
    checks: ['rate>0.90'],
  },
};

export default function () {
  const authState = authenticate(profile);

  // Browse authenticated pages.
  const pages = profile.endpoints.admin || profile.endpoints.public || [];
  for (const page of pages) {
    const start = Date.now();
    const res = http.get(`${profile.baseUrl}${page}`, {
      headers: authState.headers,
    });
    pageLoadTime.add(Date.now() - start);
    trackResponse(res, start);

    check(res, {
      [`${page} loaded`]: (r) => r.status === 200,
    });
    sleep(1 + Math.random() * 2);
  }

  sleep(2);
}
