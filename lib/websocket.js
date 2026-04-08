// stampede/lib/websocket.js
// Phoenix V2 WebSocket helpers for Stampede load tests.
// Optional — only needed when testing LiveView or Phoenix Channel targets.

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// -- Metrics -----------------------------------------------------------------

export const wsConnections = new Counter('ws_connections');
export const wsErrors = new Counter('ws_errors');
export const joinLatency = new Trend('lv_join_latency');

/**
 * Build a Phoenix V2 wire protocol message (5-element JSON array).
 */
export function phxMsg(joinRef, ref, topic, event, payload) {
  return JSON.stringify([joinRef, ref.toString(), topic, event, payload]);
}

/**
 * Extract LiveView connection props from rendered HTML.
 * Returns { csrfToken, phxSession, phxStatic, phxId } or null.
 */
export function extractLiveViewProps(html) {
  if (!html) return null;
  const csrf = html.match(/<meta name="csrf-token" content="([^"]+)"/);
  const session = html.match(/data-phx-session="([^"]+)"/);
  const staticToken = html.match(/data-phx-static="([^"]+)"/);
  const id = html.match(/id="(phx-[^"]+)"/);

  if (!csrf || !session || !staticToken || !id) return null;
  return {
    csrfToken: csrf[1],
    phxSession: session[1],
    phxStatic: staticToken[1],
    phxId: id[1],
  };
}

/**
 * Connect to a Phoenix LiveView WebSocket and join a channel.
 *
 * @param {object} opts
 * @param {string} opts.wsUrl - WebSocket URL (wss://...)
 * @param {object} opts.headers - Connection headers (e.g., Cookie)
 * @param {string} opts.topic - Channel topic (e.g., "lv:phx-xxx")
 * @param {object} opts.joinPayload - Payload for phx_join
 * @param {number} opts.holdDuration - How long to hold the connection (ms), default 60000
 * @param {number} opts.heartbeatInterval - Heartbeat interval (ms), default 30000
 */
export function connectLiveView(opts) {
  const holdDuration = opts.holdDuration || 60000;
  const heartbeatInterval = opts.heartbeatInterval || 30000;
  let msgRef = 0;
  const joinRef = '1';
  let joinStart;

  const res = ws.connect(opts.wsUrl, { headers: opts.headers || {} }, function (socket) {
    socket.on('open', function () {
      wsConnections.add(1);

      // Join the channel.
      joinStart = Date.now();
      msgRef++;
      socket.send(phxMsg(joinRef, msgRef, opts.topic, 'phx_join', opts.joinPayload));

      // Heartbeat.
      socket.setInterval(function () {
        msgRef++;
        socket.send(phxMsg(null, msgRef, 'phoenix', 'heartbeat', {}));
      }, heartbeatInterval);

      // Hold, then close.
      socket.setTimeout(function () {
        socket.close();
      }, holdDuration);
    });

    socket.on('message', function (data) {
      try {
        const msg = JSON.parse(data);
        if (!Array.isArray(msg) || msg.length !== 5) return;

        const [, ref, , event] = msg;

        if (event === 'phx_reply' && ref === '1' && joinStart) {
          joinLatency.add(Date.now() - joinStart);
          joinStart = null;
        }

        if (event === 'phx_error' || event === 'phx_close') {
          wsErrors.add(1);
        }
      } catch (_e) {
        // Ignore unparseable messages.
      }
    });

    socket.on('error', function () {
      wsErrors.add(1);
      socket.close();
    });

    socket.on('close', function () {});
  });

  check(res, { 'WebSocket connected': (r) => r && r.status === 101 });
  return res;
}
