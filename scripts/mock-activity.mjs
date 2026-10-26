/**
 * The made-up server's Activity over a range (GET /api/me/activity?range=,
 * backend/activity.py): the tokens by source in 60 columns, their totals, the
 * person's Claude pool use, and what goes on now (mock-s2.mjs activityNow).
 */
import { activityNow } from './mock-s2.mjs';

const SPANS = { m: 60, h: 3600, d: 86400 };
const wave = (i, k, amp) => Math.max(0, amp * (0.55 + 0.45 * Math.sin(i / (3 + k) + k)) * (0.6 + 0.4 * Math.cos(i / 11)));

export function handleActivity(req, res, p, json) {
  if (p !== '/api/me/activity') return false;
  const range = (new URL(req.url, 'http://x').searchParams.get('range') || '24h').trim().toLowerCase();
  const m = /^([1-9][0-9]{0,4})([mhd])$/.exec(range);
  const span = m ? +m[1] * SPANS[m[2]] : 0;
  if (!span || span < 60 || span > 30 * 86400) return json(res, 422, { detail: 'not a range' }), true;
  const n = 60;
  const step = Math.max(1, Math.round(span / n));
  const now = Math.floor(Date.now() / 1000);
  const t0 = now - n * step;
  const scale = step / 60; // a column's tokens grow with its length
  const series = {
    chat: Array.from({ length: n }, (_, i) => Math.round(wave(i, 0, 52_000 * scale))),
    orchestrator: Array.from({ length: n }, (_, i) => Math.round(wave(i, 1, 30_000 * scale) * (i > 20 ? 1 : 0.2))),
    agents: Array.from({ length: n }, (_, i) => Math.round(wave(i, 2, 18_000 * scale) * (i % 17 < 9 ? 1 : 0))),
    other: Array.from({ length: n }, (_, i) => Math.round(wave(i, 3, 6_000 * scale))),
    claude: Array.from({ length: n }, (_, i) => Math.round(wave(i, 4, 90_000 * scale) * (i > 34 ? 1 : 0.1))),
    opencode: Array.from({ length: n }, (_, i) => Math.round(wave(i, 5, 22_000 * scale) * (i > 44 ? 1 : 0))),
  };
  const by = Object.fromEntries(Object.entries(series).map(([k, v]) => [k, v.reduce((a, x) => a + x, 0)]));
  const tokens = Object.values(by).reduce((a, x) => a + x, 0);
  return json(res, 200, {
    ...activityNow(),
    range, t0, step, n,
    sources: Object.keys(series),
    series,
    total: {
      tokens, input: Math.round(tokens * 0.14), output: Math.round(tokens * 0.05), calls: Math.round(tokens / 9000), by,
      cache_read: Math.round(tokens * 0.76), cache_write: Math.round(tokens * 0.05),
    },
    claude: { prompts: Math.max(1, Math.round(by.claude / 400_000)), calls: Math.max(3, Math.round(by.claude / 60_000)), tokens: by.claude,
              input: Math.round(by.claude * 0.08), output: Math.round(by.claude * 0.04),
              cache_read: Math.round(by.claude * 0.83), cache_write: Math.round(by.claude * 0.05) },
  }), true;
}
