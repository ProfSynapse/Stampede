// stampede/profiles/example.js
// Template profile for adding new targets to Stampede.
// Copy this file and customize for your application.

export default {
  // Required: A human-readable name for this target.
  name: 'example',

  // Required: Base URL of the target application.
  // Override at runtime with STAMPEDE_BASE_URL env var.
  baseUrl: __ENV.STAMPEDE_BASE_URL || 'https://your-app.example.com',

  // Optional: WebSocket URL (only if your app uses WebSockets).
  // wsUrl: 'wss://your-app.example.com',

  // -- Auth configuration ----------------------------------------------------
  // Stampede supports these auth strategies:
  //
  //   'form_login' — POST credentials to a login page with CSRF protection
  //   'hmac'       — Compute HMAC token and pass as query param
  //   'api_key'    — Send a static API key in a header
  //   'bearer'     — Send a bearer token in the Authorization header
  //   'none'       — No authentication
  //
  auth: {
    strategy: 'none',

    // -- form_login example --
    // strategy: 'form_login',
    // loginUrl: '/login',
    // credentials: {
    //   email: __ENV.EMAIL || 'test@example.com',
    //   password: __ENV.PASSWORD || 'password',
    // },
    // csrfField: '_csrf_token',           // Name of the CSRF hidden field
    // sessionCookieName: '_session_key',   // Cookie name for WS connections
    // fieldNames: {                        // Custom form field names (optional)
    //   email: 'user[email]',
    //   password: 'user[password]',
    // },

    // -- hmac example --
    // strategy: 'hmac',
    // hmac: {
    //   secret: __ENV.HMAC_SECRET,
    //   message: `v1:resource:${__ENV.DOMAIN}:${__ENV.RESOURCE_ID}`,
    //   algorithm: 'sha256',              // 'sha256' | 'sha384' | 'sha512'
    //   encoding: 'rawurl',               // 'rawurl' | 'url' | 'std'
    //   tokenParam: 'token',              // Query param name for the token
    //   params: { domain: __ENV.DOMAIN }, // Additional query params
    // },

    // -- api_key example --
    // strategy: 'api_key',
    // apiKey: {
    //   header: 'X-API-Key',
    //   key: __ENV.API_KEY,
    // },

    // -- bearer example --
    // strategy: 'bearer',
    // bearer: {
    //   token: __ENV.AUTH_TOKEN,
    // },
  },

  // -- Endpoints (grouped by type) -------------------------------------------
  // Organize your endpoints into logical groups that patterns can reference.
  endpoints: {
    health: ['/healthz'],
    public: ['/'],
    // authenticated: ['/dashboard', '/settings'],
  },

  // -- Default thresholds ----------------------------------------------------
  // k6 threshold syntax. Patterns may override these.
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },

  // -- Content endpoints (optional) -------------------------------------------
  // Used by spike, school-bell, and concurrency patterns for content-based
  // load testing. Paths can use {LESSON_ID} as a placeholder.
  // content: {
  //   index: '/content/{LESSON_ID}/',
  //   html: '/content/{LESSON_ID}/index.html',
  //   assets: [
  //     '/content/{LESSON_ID}/style.css',
  //     '/content/{LESSON_ID}/app.js',
  //   ],
  // },

  // -- Phoenix LiveView config (optional) ------------------------------------
  // Only needed if your target is a Phoenix LiveView app and you want
  // to test WebSocket connections.
  // liveview: {
  //   websocketPath: '/live/websocket',
  //   vsn: '2.0.0',
  //   sessionCookieName: '_app_key',
  // },
};

/**
 * Resolve a content endpoint path with runtime variables.
 * Override in your profile to handle app-specific placeholders.
 */
export function contentPath(template) {
  return template;
}
