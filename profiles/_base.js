// stampede/profiles/_base.js
// Fallback profile loaded when no target.js exists.
// Provides a safe default so patterns don't crash at parse time.
// Create profiles/target.js from profiles/example.js for your app.

export default {
  name: 'unconfigured',
  baseUrl: __ENV.STAMPEDE_BASE_URL || __ENV.BASE_URL || 'http://localhost:3000',

  auth: {
    strategy: __ENV.STAMPEDE_AUTH_STRATEGY || 'none',
  },

  endpoints: {
    health: ['/healthz'],
    public: ['/'],
    admin: [],
    content: {
      index: '/',
      html: '/',
      assets: [],
    },
    mixed: [
      { path: '/healthz', weight: 1.0 },
    ],
  },

  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

/**
 * Resolve a content endpoint path — no-op for base profile.
 */
export function contentPath(template) {
  return template;
}
