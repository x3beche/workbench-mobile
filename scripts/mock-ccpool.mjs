/**
 * The made-up server's Settings > Claude pool (backend/ccpool.py's
 * GET /api/ccpool/overview) as Ada - a user, not the owner - sees it: the
 * subscription's 5-hour and 7-day windows and one model's week, three
 * people's parts of the week (with the API value their tokens would cost),
 * Outside the pool, and her own Claude Code sessions.
 */
const secs = () => Date.now() / 1000;

const fig = (requests, inT, outT, read, write, cost, last) => ({
  requests,
  errors: 0,
  in_tokens: inT,
  out_tokens: outT,
  cache_read: read,
  cache_write: write,
  total_tokens: inT + outT + read + write,
  cost_usd: cost,
  cost_estimated_usd: 0,
  last_ts: last,
});

function overview() {
  const now = secs();
  const ada = fig(842, 412_000, 268_000, 18_400_000, 1_120_000, 61.84, now - 240);
  const people = [
    { id: 'u1', name: 'Ada Demir', email: 'ada@workbench.example', mine: true, usage: ada,
      week: { ...ada, share_pct: 52.1, plan_pct: 18.42, plan_pct_approx: false, plan5_pct: 9.1, plan5_pct_approx: false, plan_manual_pct: null } },
    { id: 'u2', name: 'Bora Kaya', email: 'bora@workbench.example', mine: false,
      usage: fig(511, 230_000, 151_000, 9_800_000, 640_000, 38.1, now - 3 * 3600),
      week: { ...fig(511, 230_000, 151_000, 9_800_000, 640_000, 38.1, 0), share_pct: 32.1, plan_pct: 11.36, plan5_pct: 0, plan_manual_pct: 1.5 } },
    { id: 'u3', name: 'Cem Arslan', email: 'cem@workbench.example', mine: false,
      usage: fig(204, 88_000, 61_000, 3_900_000, 210_000, 18.75, now - 2 * 86400),
      week: { ...fig(204, 88_000, 61_000, 3_900_000, 210_000, 18.75, 0), share_pct: 15.8, plan_pct: 5.58, plan5_pct: 0, plan_manual_pct: null } },
  ];
  const session = (id, title, label, key, ago, lasted, req, prompts, cost, tok) => ({
    session_id: id, key_id: 'k1', key_name: key, title, label, preview: '', first_ts: now - ago - lasted, last_ts: now - ago,
    requests: req, prompts, in_tokens: tok[0], out_tokens: tok[1], cache_read: tok[2], cache_write: tok[3], cost_usd: cost,
    models: { 'claude-opus-4-5': req }, mine: true, hidden: false,
    status: ago < 300 ? 'active' : ago < 3600 ? 'idle' : 'ended',
  });
  const mine = [
    session('9f2c1e7a-rail', 'Sensor board rail sag', '', 'ada-laptop', 120, 2400, 214, 9, 18.3, [120_000, 84_000, 5_600_000, 310_000]),
    session('4b7e2210-ota', '', 'Add a watchdog to the OTA updater', 'workstation', 1500, 5400, 388, 14, 27.9, [190_000, 121_000, 8_100_000, 520_000]),
    session('c81d00f3-bom', 'BOM cost pass', '', 'ada-laptop', 30 * 3600, 1800, 156, 6, 11.2, [70_000, 41_000, 3_200_000, 190_000]),
    session('e0a9b4c2-lid', '', '', 'ada-laptop', 3 * 86400, 900, 84, 3, 4.1, [32_000, 22_000, 1_500_000, 100_000]),
  ];
  return {
    me: { id: 'u1', name: 'Ada Demir', role: 'user', everyone: true, owner: false, privileged: false, keys: 1,
          week: people[0].week, usage: ada, manual: null },
    credential: {},
    plan: {
      basis: 'subscription',
      five_hour: { pct: 9.1, resets_at: now + 2 * 3600 + 14 * 60 },
      seven_day: { pct: 41.6, resets_at: now + 3 * 86400 + 5 * 3600 },
      extra: [{ id: 'limit-0', label: '7-day Opus', pct: 78.0, resets_at: now + 3 * 86400 + 5 * 3600 }],
      week_pct: 41.6,
      week_api_usd: 118.69,
      week_from: now - 4 * 86400 + 5 * 3600,
      week_to: now + 3 * 86400 + 5 * 3600,
      plan_basis: 'readings',
      outside: { seven_day: 6.24, five_hour: 0 },
      unassigned_plan: { seven_day: null, five_hour: null },
      manual: null,
    },
    accounts: people,
    unassigned: [],
    series: [],
    prices: null,
    sessions: mine,
    my_sessions: mine,
    my_hidden: { count: 1, cost_usd: 0.42 },
    session_status: { active_s: 300, idle_s: 3600 },
    recent: [],
    totals: ada,
    week_totals: { plan_pct: 41.6 },
    people: [],
    without: [],
    gateway: { url: 'http://127.0.0.1:8100', configured: true },
  };
}

/** GET /api/ccpool/overview; false for any other path. */
export function handleCcpool(req, res, p) {
  if (p !== '/api/ccpool/overview' || req.method !== 'GET') return false;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(overview()));
  return true;
}
