// stampede/profiles/coursecast.js
// Profile for CourseCast (Phoenix/LiveView LMS platform).
// Supports both admin (form login) and student (HMAC token) auth flows.

// -- Environment variable overrides ------------------------------------------
// All values can be overridden via env vars at runtime.

const BASE_URL = __ENV.STAMPEDE_BASE_URL || __ENV.BASE_URL || 'https://coursecast-staging.fly.dev';

export default {
  name: 'coursecast',
  baseUrl: BASE_URL,
  wsUrl: BASE_URL.replace('https', 'wss').replace('http', 'ws'),

  // -- Auth: two strategies available ----------------------------------------
  // Select via STAMPEDE_AUTH_STRATEGY env var (default: form_login for admin tests).
  // HMAC is used for student content tests (spike, school-bell patterns).
  auth: getAuthConfig(),

  // -- Endpoints (grouped by type) -------------------------------------------
  endpoints: {
    // Health check — no auth required.
    health: ['/healthz'],

    // Admin pages — requires form_login auth.
    admin: [
      '/admin',
      '/admin/courses',
      '/admin/institutions',
      '/admin/reports',
      '/admin/profile',
    ],

    // Public pages — no auth required.
    public: [
      '/users/log-in',
    ],

    // Student content — requires HMAC auth.
    // LESSON_ID is injected at runtime; patterns use the contentPath() helper.
    content: {
      index: '/lessons/{LESSON_ID}/',
      html: '/lessons/{LESSON_ID}/scormdriver/indexAPI.html',
      assets: [
        '/lessons/{LESSON_ID}/scormcontent/assets/css/main.css',
        '/lessons/{LESSON_ID}/scormcontent/assets/js/main.js',
        '/lessons/{LESSON_ID}/scormcontent/assets/images/logo.png',
      ],
    },

    // Mixed endpoint weights for throughput tests.
    mixed: [
      { path: '/healthz', weight: 0.4 },
      { path: '/users/log-in', weight: 0.3 },
      { path: '/lessons/00000000-0000-0000-0000-000000000000/', weight: 0.3 },
    ],
  },

  // -- Default thresholds ----------------------------------------------------
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },

  // -- Phoenix LiveView config (optional, for WebSocket patterns) ------------
  liveview: {
    websocketPath: '/live/websocket',
    vsn: '2.0.0',
    sessionCookieName: '_coursecast_key',
  },
};

/**
 * Build auth config based on STAMPEDE_AUTH_STRATEGY env var.
 */
function getAuthConfig() {
  const strategy = __ENV.STAMPEDE_AUTH_STRATEGY || 'form_login';

  if (strategy === 'hmac') {
    // HMAC auth for student content tests.
    const lessonId = __ENV.LESSON_ID;
    const instDomain = __ENV.INST_DOMAIN;
    const hmacSecret = __ENV.HMAC_SECRET;
    const accessToken = __ENV.ACCESS_TOKEN;

    if (accessToken) {
      // Pre-computed token provided — skip HMAC computation.
      // Use api_key strategy with query params instead.
      return {
        strategy: 'none',
        _precomputedParams: `inst=${encodeURIComponent(instDomain || '')}&token=${encodeURIComponent(accessToken)}`,
      };
    }

    if (!hmacSecret || !lessonId || !instDomain) {
      // Don't fail at parse time — fail at runtime when auth is attempted.
      return { strategy: 'hmac', hmac: null };
    }

    return {
      strategy: 'hmac',
      hmac: {
        secret: hmacSecret,
        message: `v1:lesson:${instDomain}:${lessonId}`,
        algorithm: 'sha256',
        encoding: 'rawurl',
        tokenParam: 'token',
        params: { inst: instDomain },
      },
    };
  }

  // Default: form login for admin tests.
  return {
    strategy: 'form_login',
    loginUrl: '/users/log-in',
    credentials: {
      email: __ENV.EMAIL || __ENV.STAMPEDE_EMAIL || 'joe@aiforeducation.io',
      password: __ENV.PASSWORD || __ENV.STAMPEDE_PASSWORD || 'changeme',
    },
    csrfField: '_csrf_token',
    sessionCookieName: '_coursecast_key',
  };
}

/**
 * Resolve a content endpoint path with the current LESSON_ID.
 */
export function contentPath(template) {
  const lessonId = __ENV.LESSON_ID;
  if (!lessonId) return template;
  return template.replace('{LESSON_ID}', lessonId);
}
