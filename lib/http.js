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
