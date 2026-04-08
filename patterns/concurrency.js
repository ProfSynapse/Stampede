// stampede/patterns/concurrency.js
// Flat instant-jump stress: immediately spawns VUS virtual users and holds
// for DURATION. No ramp = maximum simultaneous stress on connection pool
// and cache. Tests true concurrent capacity, not gradual scaling.
//
// Env vars:
//   STAMPEDE_MAX_VUS        — Number of VUs (default: 5000)
//   STAMPEDE_DURATION       — Hold duration (default: 2m)
//   STAMPEDE_AUTH_STRATEGY  — 'hmac' for student content tests
//   LESSON_ID, INST_DOMAIN, HMAC_SECRET — Required for hmac auth
//
// Usage:
//   STAMPEDE_MAX_VUS=5000 STAMPEDE_DURATION=2m \
//     k6 run stampede/patterns/concurrency.js

import http from 'k6/http';
import { check } from 'k6';
import profile, { contentPath } from '../profiles/target.js';
import { authenticate } from '../lib/auth.js';
import { trackResponse } from '../lib/metrics.js';
import { urlWithParams } from '../lib/http.js';

const VUS = parseInt(__ENV.STAMPEDE_MAX_VUS || '5000');
const DURATION = __ENV.STAMPEDE_DURATION || '2m';

export const options = {
  scenarios: {
    concurrency: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    server_error_rate: [{ threshold: 'rate<0.20' }],
    'http_req_duration{expected_response:true}': ['p(95)<3000'],
  },
};

export default function () {
  const authState = authenticate(profile);

  if (profile.auth.strategy === 'hmac' || __ENV.STAMPEDE_AUTH_STRATEGY === 'hmac') {
    // Student content flow.
    const indexUrl = urlWithParams(
      `${profile.baseUrl}${contentPath(profile.endpoints.content.index)}`,
      authState.params
    );
    const start = Date.now();
    const res = http.get(indexUrl, { redirects: 5, headers: authState.headers });
    trackResponse(res, start);
    check(res, {
      'status is 2xx': (r) => r.status >= 200 && r.status < 300,
      'not 502': (r) => r.status !== 502,
      'not 503': (r) => r.status !== 503,
    });
  } else {
    // Admin/public page flow.
    const pages = profile.endpoints.admin || profile.endpoints.public || [];
    const page = pages[Math.floor(Math.random() * pages.length)];
    if (page) {
      const start = Date.now();
      const res = http.get(`${profile.baseUrl}${page}`, { headers: authState.headers });
      trackResponse(res, start);
      check(res, { 'page loaded': (r) => r.status === 200 });
    }
  }

  // No sleep — maximum pressure. Each VU loops as fast as possible.
}
