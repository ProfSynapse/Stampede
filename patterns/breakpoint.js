// stampede/patterns/breakpoint.js
// Scale until it breaks: ramp from 10 to MAX_VUS over escalating stages.
// Combines HTTP + WebSocket (if available). Abort thresholds on p95 > 5s
// or error rate > 10%.
//
// Env vars:
//   STAMPEDE_MAX_VUS  — Peak VU count (default: 500)
//   STAMPEDE_STEP     — VU increment per stage (default: 1000)
//   STAMPEDE_HOLD     — Hold duration per stage (default: 30s)
//
// Usage:
//   k6 run stampede/patterns/breakpoint.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import profile from '../profiles/target.js';
import { authenticate } from '../lib/auth.js';
import { trackResponse } from '../lib/metrics.js';
import { extractLiveViewProps, connectLiveView } from '../lib/websocket.js';

const MAX_VUS = parseInt(__ENV.STAMPEDE_MAX_VUS || '500');
const STEP = parseInt(__ENV.STAMPEDE_STEP || '1000');
const HOLD = __ENV.STAMPEDE_HOLD || '30s';

// Build escalating stages dynamically.
const stages = [{ duration: '1m', target: 10 }];
const levels = [50, 100, 200, 350];
for (let vus = 500; vus <= MAX_VUS; vus += STEP) {
  levels.push(vus);
}
for (const level of levels.filter((v) => v <= MAX_VUS)) {
  stages.push({ duration: '2m', target: level });
}
stages.push({ duration: '30s', target: 0 });

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages,
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true, delayAbortEval: '30s' }],
    checks: ['rate>0.80'],
  },
};

export default function () {
  const authState = authenticate(profile);

  // Hit a random authenticated page.
  const pages = profile.endpoints.admin || profile.endpoints.public || [];
  const page = pages[Math.floor(Math.random() * pages.length)];
  if (!page) {
    sleep(2);
    return;
  }

  const start = Date.now();
  const pageRes = http.get(`${profile.baseUrl}${page}`, {
    headers: authState.headers,
  });
  trackResponse(pageRes, start);
  check(pageRes, { 'page loaded': (r) => r.status === 200 });

  // Attempt LiveView WebSocket connection (if profile supports it).
  if (profile.liveview) {
    const props = extractLiveViewProps(pageRes.body);
    if (props) {
      const wsUrl = `${profile.wsUrl}${profile.liveview.websocketPath}?vsn=${profile.liveview.vsn}&_csrf_token=${encodeURIComponent(props.csrfToken)}`;
      const wsHeaders = {};
      if (authState.cookies) {
        wsHeaders['Cookie'] = authState.cookies;
      }

      connectLiveView({
        wsUrl,
        headers: wsHeaders,
        topic: `lv:${props.phxId}`,
        joinPayload: {
          url: `${profile.baseUrl}${page}`,
          params: { _csrf_token: props.csrfToken, _mounts: 0 },
          session: props.phxSession,
          static: props.phxStatic,
        },
        holdDuration: 90000,
      });
    }
  }

  sleep(1);
}
