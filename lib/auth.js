// stampede/lib/auth.js
// Pluggable authentication strategies for Stampede load tests.
// Each strategy returns an authenticated state that patterns can use
// for subsequent requests.

import http from 'k6/http';
import { check, fail } from 'k6';
import encoding from 'k6/encoding';
import { hmac } from 'k6/crypto';
import { extractCsrfToken, randomIp } from './http.js';

/**
 * Authenticate a VU using the strategy defined in the profile.
 *
 * @param {object} profile - The loaded profile config
 * @returns {object} Auth state: { headers, cookies, params, jar }
 *   - headers: Extra headers to include on every request
 *   - cookies: Cookie string to include (for WebSocket connections)
 *   - params: Query params to append to URLs (for token-based auth)
 *   - jar: k6 cookie jar with session cookies
 */
export function authenticate(profile) {
  const strategy = profile.auth && profile.auth.strategy;

  switch (strategy) {
    case 'form_login':
      return formLogin(profile);
    case 'hmac':
      return hmacAuth(profile);
    case 'api_key':
      return apiKeyAuth(profile);
    case 'bearer':
      return bearerAuth(profile);
    case 'none':
    case undefined:
      return noAuth(profile);
    default:
      fail(`Unknown auth strategy: ${strategy}`);
      return noAuth();
  }
}

// -- Strategy: Form Login with CSRF -----------------------------------------

function formLogin(profile) {
  const jar = http.cookieJar();
  const auth = profile.auth;

  if (!auth.loginUrl) {
    fail('form_login strategy requires auth.loginUrl');
  }
  if (!auth.credentials || !auth.credentials.email || !auth.credentials.password) {
    fail('form_login strategy requires auth.credentials.email and auth.credentials.password');
  }

  // Step 1: GET the login page, extract CSRF token.
  const loginPage = http.get(`${profile.baseUrl}${auth.loginUrl}`);
  check(loginPage, { 'login page loaded': (r) => r.status === 200 });

  const csrfToken = extractCsrfToken(loginPage.body);
  if (!csrfToken) {
    fail('Could not extract CSRF token from login page');
  }

  // Step 2: POST credentials.
  // Build form body — supports custom field names or defaults to Phoenix phx.gen.auth convention.
  const formBody = {};
  formBody[auth.csrfField || '_csrf_token'] = csrfToken;

  if (auth.fieldNames) {
    formBody[auth.fieldNames.email] = auth.credentials.email;
    formBody[auth.fieldNames.password] = auth.credentials.password;
  } else {
    formBody['user[email]'] = auth.credentials.email;
    formBody['user[password]'] = auth.credentials.password;
  }

  const loginRes = http.post(
    `${profile.baseUrl}${auth.loginUrl}`,
    formBody,
    { redirects: 5 }
  );
  check(loginRes, { 'login succeeded': (r) => r.status === 200 });

  // Extract session cookie name for WebSocket connections.
  const cookieName = auth.sessionCookieName || '_session_key';
  const cookies = jar.cookiesForURL(profile.baseUrl);
  let cookieStr = '';
  if (cookies[cookieName] && cookies[cookieName].length > 0) {
    cookieStr = `${cookieName}=${cookies[cookieName][0]}`;
  }

  return {
    headers: { 'x-csrf-token': csrfToken, 'X-Forwarded-For': randomIp() },
    cookies: cookieStr,
    params: '',
    jar,
  };
}

// -- Strategy: HMAC Token ---------------------------------------------------

function hmacAuth(profile) {
  const auth = profile.auth;

  if (!auth.hmac) {
    fail('hmac strategy requires auth.hmac config');
  }

  const { secret, message, algorithm, encoding: enc } = auth.hmac;

  if (!secret) {
    fail('hmac strategy requires auth.hmac.secret');
  }
  if (!message) {
    fail('hmac strategy requires auth.hmac.message (template string with {placeholders})');
  }

  // Compute HMAC token.
  const algo = algorithm || 'sha256';
  const raw = hmac(algo, secret, message, 'binary');
  const token = encoding.b64encode(raw, enc || 'rawurl');

  // Build query params from the hmac.params map.
  const paramParts = [];
  if (auth.hmac.params) {
    for (const [key, value] of Object.entries(auth.hmac.params)) {
      paramParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  // Append the token param.
  const tokenParam = auth.hmac.tokenParam || 'token';
  paramParts.push(`${encodeURIComponent(tokenParam)}=${encodeURIComponent(token)}`);

  return {
    headers: { 'X-Forwarded-For': randomIp() },
    cookies: '',
    params: paramParts.join('&'),
    jar: http.cookieJar(),
  };
}

// -- Strategy: API Key Header -----------------------------------------------

function apiKeyAuth(profile) {
  const auth = profile.auth;

  if (!auth.apiKey) {
    fail('api_key strategy requires auth.apiKey config');
  }

  const headerName = auth.apiKey.header || 'X-API-Key';
  const key = auth.apiKey.key;

  if (!key) {
    fail('api_key strategy requires auth.apiKey.key');
  }

  return {
    headers: { [headerName]: key, 'X-Forwarded-For': randomIp() },
    cookies: '',
    params: '',
    jar: http.cookieJar(),
  };
}

// -- Strategy: Bearer Token -------------------------------------------------

function bearerAuth(profile) {
  const auth = profile.auth;

  if (!auth.bearer || !auth.bearer.token) {
    fail('bearer strategy requires auth.bearer.token');
  }

  return {
    headers: { Authorization: `Bearer ${auth.bearer.token}`, 'X-Forwarded-For': randomIp() },
    cookies: '',
    params: '',
    jar: http.cookieJar(),
  };
}

// -- Strategy: No Auth ------------------------------------------------------

function noAuth(profile) {
  return {
    headers: { 'X-Forwarded-For': randomIp() },
    cookies: '',
    params: (profile && profile.auth && profile.auth._precomputedParams) || '',
    jar: http.cookieJar(),
  };
}
