/**
 * The made-up server's live streams (1.5.9): a small stand-in for s2-lite
 * behind Workbench's gate (backend/s2live.py, docker/s2gate), enough for the
 * app's S2 reader - POST /api/s2/token and /api/s2/streams, and under /s2/
 * a stream's tail and its live read (SSE `batch` events with seq_num, pings,
 * resume from seq_num). The token is checked in the Authorization header
 * only, as the gate does for an XHR; one in the address is refused.
 *
 * MOCK_S2=0 turns it off (the token route answers 503): the app polls.
 */
import { randomBytes } from 'node:crypto';

const ON = process.env.MOCK_S2 !== '0';
const ACCOUNT = 'u1';
const PREFIX = `acct/${ACCOUNT}/`;
const tokens = new Set();
/** name -> { records: [{seq_num, body, timestamp}], readers: Set<res> } */
const streams = new Map();
/** How many live reads were opened, by stream (the screenshot scripts print it). */
export const reads = {};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function stream(name) {
  let s = streams.get(name);
  if (!s) streams.set(name, (s = { records: [], readers: new Set() }));
  return s;
}

/** Append a record to one of the account's streams (`bus`, `orch`, `chat-<id>`, `activity`). */
export function publish(name, body) {
  if (!ON) return;
  const s = stream(PREFIX + name);
  const rec = { seq_num: s.records.length, body: JSON.stringify(body), timestamp: Date.now() };
  s.records.push(rec);
  for (const res of s.readers) res.write(`event: batch\ndata: ${JSON.stringify({ records: [rec] })}\n\n`);
}

/** Is a live read of this stream open (the app follows it)? */
export function watched(name) {
  return (streams.get(PREFIX + name)?.readers.size ?? 0) > 0;
}

/** POST /api/s2/token, /api/s2/streams; false for any other path. */
export function handleS2Api(req, res, p, body) {
  if (p === '/api/s2/token' && req.method === 'POST') {
    if (!ON) return json(res, 503, { detail: 'live streams are off' }), true;
    const token = `mock-${randomBytes(12).toString('hex')}`;
    tokens.add(token);
    stream(PREFIX + 'activity');
    stream(PREFIX + 'bus');
    return json(res, 200, {
      token,
      expires_at: Math.floor(Date.now() / 1000) + 900,
      basin: 'workbench-live',
      stream: PREFIX + 'activity',
      prefix: PREFIX,
      path: '/s2',
    }), true;
  }
  if (p === '/api/s2/streams' && req.method === 'POST') {
    if (!ON) return json(res, 503, { detail: 'live streams are off' }), true;
    const names = JSON.parse(body.toString() || '{}').names || [];
    for (const n of names) stream(PREFIX + n);
    return json(res, 200, { ready: names }), true;
  }
  return false;
}

/** Everything under /s2/ (the gate). */
export function handleS2(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.searchParams.has('token')) return json(res, 400, { detail: 'a token goes in the Authorization header' });
  const auth = req.headers.authorization || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tokens.has(tok)) return json(res, 401, { detail: 'token' });
  const m = url.pathname.match(/^\/s2\/v1\/streams\/([^/]+)\/records(\/tail)?$/);
  if (!m || req.method !== 'GET') return json(res, 404, { detail: 'Not Found' });
  const name = decodeURIComponent(m[1]);
  if (!name.startsWith(PREFIX)) return json(res, 403, { detail: 'not yours' });
  const s = streams.get(name);
  if (!s) return json(res, 404, { detail: 'stream not found' });
  if (m[2]) return json(res, 200, { tail: { seq_num: s.records.length, timestamp: Date.now() } });
  const last = s.records.length;
  let from = last;
  if (url.searchParams.has('seq_num')) from = Math.min(last, Number(url.searchParams.get('seq_num')));
  else if (url.searchParams.has('tail_offset')) from = Math.max(0, last - Number(url.searchParams.get('tail_offset')));
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  res.flushHeaders(); // open at once, as s2 answers a read before it has a record
  const behind = s.records.filter((r) => r.seq_num >= from);
  if (behind.length) res.write(`event: batch\ndata: ${JSON.stringify({ records: behind })}\n\n`);
  s.readers.add(res);
  reads[name] = (reads[name] || 0) + 1;
  const ping = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 15_000);
  req.on('close', () => {
    clearInterval(ping);
    s.readers.delete(res);
  });
}

// What goes on now, every second while someone reads it (the web top bar's Activity).
let beat = 0;
export function activityNow() {
  beat++;
  const tps = Math.max(0, 38 + 22 * Math.sin(beat / 2.3) + (beat % 4) * 3);
  return {
    at: Math.floor(Date.now() / 1000),
    live: { tps, by: { chat: tps * 0.7, orchestrator: tps * 0.3 }, window_s: 10 },
    jobs: { running: 2, queued: 1, agents: 1, total: 3, kinds: { build: 1, render: 1 } },
    machine: { cpu_pct: 18 + (beat % 5) * 3, mem_mb: 3480 + (beat % 7) * 40, sampled: true,
               parts: [{ kind: 'orchestrator', name: 'orchestrator', cpu_pct: 9 + (beat % 3), mem_mb: 1450 },
                       { kind: 'sandbox', name: 'main', cpu_pct: 6, mem_mb: 1900 }, { kind: 'jobs', name: 'pool', cpu_pct: null, mem_mb: 130 }] },
  };
}
if (ON) {
  setInterval(() => {
    if (watched('activity')) publish('activity', activityNow());
  }, 1000).unref();
}
