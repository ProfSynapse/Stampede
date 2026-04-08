// stampede/lib/metrics.js
// Common metric tracking for Stampede load tests.
// Provides status code counters and error categorization.

import { Counter, Rate, Trend } from 'k6/metrics';

// -- Status code counters ----------------------------------------------------

const statusCounters = {
  0:   new Counter('status_0_connection_failed'),
  200: new Counter('status_200'),
  301: new Counter('status_301'),
  302: new Counter('status_302'),
  400: new Counter('status_400'),
  403: new Counter('status_403'),
  404: new Counter('status_404'),
  429: new Counter('status_429_rate_limited'),
  500: new Counter('status_500'),
  502: new Counter('status_502_bad_gateway'),
  503: new Counter('status_503_unavailable'),
  504: new Counter('status_504_gateway_timeout'),
};
const statusOther = new Counter('status_other');

// -- Error type counters -----------------------------------------------------

const errTimeout = new Counter('err_timeout');
const errConnRefused = new Counter('err_connection_refused');
const errDnsLookup = new Counter('err_dns_lookup');
const errTls = new Counter('err_tls');

// -- Shared metrics (available for import) -----------------------------------

export const serverErrors = new Rate('server_error_rate');
export const requestDuration = new Trend('request_duration');

/**
 * Track an HTTP response status code.
 */
export function trackStatus(status) {
  if (statusCounters[status]) {
    statusCounters[status].add(1);
  } else {
    statusOther.add(1);
  }
}

/**
 * Track error type from a k6 response.
 */
export function trackError(res) {
  if (res.error) {
    const e = res.error;
    if (e.includes('timeout') || e.includes('deadline')) errTimeout.add(1);
    else if (e.includes('connection refused')) errConnRefused.add(1);
    else if (e.includes('dns') || e.includes('lookup')) errDnsLookup.add(1);
    else if (e.includes('tls') || e.includes('certificate')) errTls.add(1);
  }
}

/**
 * Track a full response: status, errors, server error rate, and duration.
 */
export function trackResponse(res, startTime) {
  trackStatus(res.status);
  trackError(res);
  serverErrors.add(res.status >= 500 || res.status === 0);
  if (startTime) {
    requestDuration.add(Date.now() - startTime);
  }
}
