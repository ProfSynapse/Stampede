// stampede/patterns/spike.js
// Escalating VU spikes with recovery periods.
// Tests how the system handles sudden traffic surges and recovers afterward.
//
// Spike pattern:
//   1. Warm up: 10 VUs for 30s
//   2. SPIKE 1: instant jump to 500, hold 1m
//   3. Recovery 1: drop to 50, hold 1m
//   4. SPIKE 2: instant jump to 1000, hold 1m
//   5. Recovery 2: drop to 50, hold 1m
//   6. Ramp down to 0
//
// Env vars:
//   STAMPEDE_MAX_VUS     — Peak VU count for spike 2 (default: 1000)
//   STAMPEDE_BASE_URL    — Override profile base URL
//   STAMPEDE_AUTH_STRATEGY — 'hmac' for student content (default: form_login)
//   LESSON_ID, INST_DOMAIN, HMAC_SECRET — Required for hmac auth
//
// Usage:
//   STAMPEDE_AUTH_STRATEGY=hmac LESSON_ID=abc INST_DOMAIN=demo.edu HMAC_SECRET=xyz \
//     k6 run stampede/patterns/spike.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import profile, { contentPath } from '../profiles/target.js';
import { authenticate } from '../lib/auth.js';
import { trackResponse, serverErrors } from '../lib/metrics.js';
import { urlWithParams } from '../lib/http.js';

const contentLoadTime = new Trend('content_load_time');
const authErrors = new Counter('auth_errors');
const maxVus = parseInt(__ENV.STAMPEDE_MAX_VUS || '1000');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },                          // 1. Warm up
        { duration: '1s', target: Math.ceil(maxVus * 0.5) },     // 2. SPIKE 1
        { duration: '1m', target: Math.ceil(maxVus * 0.5) },     //    Hold
        { duration: '1s', target: 50 },                            // 3. Recovery 1
        { duration: '1m', target: 50 },                            //    Observe
        { duration: '1s', target: maxVus },                        // 4. SPIKE 2
        { duration: '1m', target: maxVus },                        //    Hold
        { duration: '1s', target: 50 },                            // 5. Recovery 2
        { duration: '1m', target: 50 },                            //    Observe
        { duration: '30s', target: 0 },                            // 6. Ramp down
      ],
    },
  },
  thresholds: {
    server_error_rate: [{ threshold: 'rate<0.15', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true, delayAbortEval: '30s' }],
    content_load_time: ['p(95)<5000'],
    auth_errors: ['count<50'],
    checks: ['rate>0.85'],
  },
};

export default function () {
  const authState = authenticate(profile);

  if (profile.auth.strategy === 'hmac' || __ENV.STAMPEDE_AUTH_STRATEGY === 'hmac') {
    // Student content flow — hit lesson endpoint with HMAC auth.
    const indexUrl = urlWithParams(
      `${profile.baseUrl}${contentPath(profile.endpoints.content.index)}`,
      authState.params
    );
    const start = Date.now();
    const res = http.get(indexUrl, { redirects: 5, headers: authState.headers });
    contentLoadTime.add(Date.now() - start);
    trackResponse(res, start);

    const ok = check(res, {
      'content loaded': (r) => r.status === 200,
      'not 403': (r) => r.status !== 403,
    });

    if (!ok) {
      authErrors.add(1);
      sleep(2);
      return;
    }

    // Load SCORM HTML and assets.
    const htmlUrl = `${profile.baseUrl}${contentPath(profile.endpoints.content.html)}`;
    http.get(htmlUrl, { redirects: 5, headers: authState.headers });

    for (const assetTemplate of profile.endpoints.content.assets) {
      const assetUrl = `${profile.baseUrl}${contentPath(assetTemplate)}`;
      http.get(assetUrl, { redirects: 5, headers: authState.headers, tags: { name: 'asset' } });
    }
  } else {
    // Admin flow — hit authenticated admin pages.
    const pages = profile.endpoints.admin || [];
    const page = pages[Math.floor(Math.random() * pages.length)];
    if (page) {
      const start = Date.now();
      const res = http.get(`${profile.baseUrl}${page}`, { headers: authState.headers });
      contentLoadTime.add(Date.now() - start);
      trackResponse(res, start);
      check(res, { 'page loaded': (r) => r.status === 200 });
    }
  }

  sleep(2 + Math.random() * 3);
}
