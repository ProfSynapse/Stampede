// stampede/lib/http.js
// Common HTTP helpers for Stampede load tests.

/**
 * Extract a CSRF token from a page's <meta> tag.
 * Works with Phoenix's default CSRF meta tag.
 */
export function extractCsrfToken(html) {
  if (!html) return null;
  const match = html.match(/<meta name="csrf-token" content="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Build a URL with query params appended.
 * @param {string} base - The base URL
 * @param {string} params - Query string (without leading ?)
 * @returns {string} Full URL
 */
export function urlWithParams(base, params) {
  if (!params) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params}`;
}

/**
 * Generate a random public IPv4 address for X-Forwarded-For headers.
 * Avoids reserved ranges (0.x, 224+). Each VU iteration gets a unique IP
 * so the target's rate limiter treats them as distinct clients.
 */
export function randomIp() {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}
