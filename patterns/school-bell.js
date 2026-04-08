// stampede/patterns/school-bell.js
// Realistic class schedule pattern — jagged spikes simulating school bells,
// lunch rushes, and class changes. No smooth ramp; instant jumps with random
// drops between "bells."
//
// Bell pattern (6 bells):
//   Bell 1: Morning rush — 2000 VUs
//   Bell 2: Second period — 5000 VUs
//   Bell 3: Surprise mid-class — 3000 VUs
//   Bell 4: Lunch rush — MAX (8000 VUs)
//   Bell 5: Afternoon — 6000 VUs
//   Bell 6: End of day mega spike — 10000 VUs
//
// All VU counts scale proportionally with STAMPEDE_MAX_VUS.
//
// Env vars:
//   STAMPEDE_MAX_VUS        — Scales the max bell (default: 10000)
//   STAMPEDE_AUTH_STRATEGY  — 'hmac' for student content tests
//   LESSON_ID, INST_DOMAIN, HMAC_SECRET — Required for hmac auth
//
// Usage:
//   STAMPEDE_AUTH_STRATEGY=hmac LESSON_ID=abc INST_DOMAIN=demo.edu HMAC_SECRET=xyz \
//     k6 run stampede/patterns/school-bell.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import profile, { contentPath } from '../profiles/target.js';
import { authenticate } from '../lib/auth.js';
import { trackResponse } from '../lib/metrics.js';
import { urlWithParams } from '../lib/http.js';

const MAX_VUS = parseInt(__ENV.STAMPEDE_MAX_VUS || '10000');

// Scale bell levels proportionally.
function scale(fraction) {
  return Math.ceil(MAX_VUS * fraction);
}

export const options = {
  scenarios: {
    jagged: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },                 // baseline

        // Bell 1: morning rush
        { duration: '1s', target: scale(0.2) },
        { duration: '20s', target: scale(0.2) },
        { duration: '1s', target: scale(0.02) },
        { duration: '10s', target: scale(0.02) },

        // Bell 2: second period, bigger spike
        { duration: '1s', target: scale(0.5) },
        { duration: '20s', target: scale(0.5) },
        { duration: '1s', target: scale(0.05) },
        { duration: '10s', target: scale(0.05) },

        // Bell 3: surprise spike mid-class
        { duration: '1s', target: scale(0.3) },
        { duration: '15s', target: scale(0.3) },
        { duration: '1s', target: scale(0.01) },
        { duration: '5s', target: scale(0.01) },

        // Bell 4: lunch rush — max spike
        { duration: '1s', target: scale(0.8) },
        { duration: '20s', target: scale(0.8) },
        { duration: '1s', target: scale(0.03) },
        { duration: '10s', target: scale(0.03) },

        // Bell 5: afternoon — another big one
        { duration: '1s', target: scale(0.6) },
        { duration: '20s', target: scale(0.6) },
        { duration: '1s', target: scale(0.005) },
        { duration: '10s', target: scale(0.005) },

        // Bell 6: end of day mega spike
        { duration: '1s', target: MAX_VUS },
        { duration: '20s', target: MAX_VUS },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    server_error_rate: [{ threshold: 'rate<0.50', abortOnFail: true, delayAbortEval: '15s' }],
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

  sleep(Math.random() * 2);
}
