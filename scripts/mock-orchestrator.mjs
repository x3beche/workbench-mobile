/**
 * The made-up server's Orchestrator (backend/orchestrator): its state, its
 * sub-agent tree, two sessions' transcripts, the live stream (a new answer
 * written a few words at a time, then held open), the MCP tools, Start and
 * Stop and the model. MOCK_ORCH=halted starts it stopped for a refused key,
 * MOCK_ORCH=stopped not running. Used by scripts/mock-api.mjs.
 */
import { publish } from './mock-s2.mjs';

const T0 = Date.now() - 9 * 60_000;
const at = (s) => T0 + s * 1000;

const PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openrouter',
    key_hint: '…7f2c',
    ok: true,
    models: ['anthropic/claude-sonnet-4.5', 'anthropic/claude-haiku-4.5', 'openai/gpt-5', 'qwen/qwen3-coder', 'google/gemini-2.5-pro'],
  },
  { id: 'anthropic', name: 'Anthropic', kind: 'anthropic', key_hint: '…a91d', ok: true, models: ['claude-sonnet-4-5', 'claude-haiku-4-5'] },
];

const mode = process.env.MOCK_ORCH || 'running';
const state = {
  desired: mode === 'running' ? 'running' : 'stopped',
  halted:
    mode === 'halted'
      ? { kind: 'auth', message: 'OpenRouter: 401 invalid api key', at: new Date(Date.now() - 20 * 60_000).toISOString() }
      : null,
  choice: { provider_id: 'openrouter', model: 'anthropic/claude-sonnet-4.5' },
};

function status() {
  const running = state.desired === 'running';
  return {
    state: state.halted ? 'halted' : running ? 'running' : 'stopped',
    desired: state.halted ? 'stopped' : state.desired,
    halted: state.halted,
    error: null,
    crash_loop: false,
    last_failure: null,
    next_try_at: null,
    started_at: running ? new Date(T0).toISOString() : null,
    provider_id: state.choice.provider_id,
    model: state.choice.model,
    session: 'ses_root',
    choice: state.choice,
    providers: PROVIDERS,
    limits: { mem_mb: 1536, cpus: 1 },
    mcp_version: '2.4.0',
  };
}

const TREE = {
  root: 'ses_root',
  nodes: [
    { id: 'ses_root', parentID: null, title: 'Orchestrator', agent: 'orchestrator', state: 'running', started: at(0), updated: at(500),
      last_step: { kind: 'tool', tool: 'workbench_board_step', text: 'route' } },
    { id: 'ses_cad', parentID: 'ses_root', title: 'Snap-fit lid, 1.6 mm walls', agent: 'cad', state: 'done', started: at(40), updated: at(260),
      last_step: { kind: 'text', text: 'Lid rebuilt: 4 snap hooks, 0.3 mm clearance.' } },
    { id: 'ses_pcb', parentID: 'ses_root', title: 'Move J3 to the board edge', agent: 'pcb', state: 'running', started: at(300), updated: at(520),
      last_step: { kind: 'tool', tool: 'workbench_board_step', text: 'route GND pour' } },
    { id: 'ses_pcb2', parentID: 'ses_pcb', title: 'DRC check', agent: 'pcb', state: 'retry', started: at(470), updated: at(530),
      last_step: { kind: 'thinking', text: 'clearance on the USB pair' } },
  ],
};

const tool = (tool, input, extra = {}) => ({
  type: 'tool',
  tool,
  status: 'completed',
  input: JSON.stringify(input),
  ...extra,
});

const ROOT = {
  id: 'ses_root',
  parentID: null,
  title: 'Orchestrator',
  agent: 'orchestrator',
  state: 'running',
  truncated: false,
  messages: [
    {
      id: 'm1', role: 'user', agent: null, time: at(10), done: at(10),
      parts: [{ type: 'text', text: 'WB-THREAD 3D Drawing · Ada Demir · 09:12\nMake the enclosure lid snap-fit with 1.6 mm PETG walls.' }],
    },
    {
      id: 'm2', role: 'assistant', agent: 'orchestrator', time: at(12), done: at(270),
      parts: [
        { type: 'reasoning', text: 'A CAD change: the cad agent does it; I check the build and answer in the room.' },
        tool('workbench_model_info', { model: 'enclosure-v3' }, { title: 'enclosure-v3', start: at(14), end: at(15),
          output: 'enclosure-v3: lid + base, walls 2.0 mm, 4 screws M3' }),
        tool('task', { subagent_type: 'cad', description: 'Snap-fit lid, 1.6 mm walls' }, { start: at(40), end: at(260), session: 'ses_cad',
          output: 'Lid rebuilt: 4 snap hooks, 0.3 mm clearance, walls 1.6 mm.' }),
        tool('workbench_say', { room: 'cad', text: 'The lid snaps on now: four hooks, 1.6 mm PETG walls, 0.3 mm clearance. Build is green.' }, { start: at(268), end: at(269) }),
      ],
    },
    {
      id: 'm3', role: 'user', agent: null, time: at(290), done: at(290),
      parts: [{ type: 'text', text: 'WB-THREAD PCB Design · Ada Demir · 09:17\nMove J3 to the board edge and keep the USB pair at 90 ohm.' }],
    },
    {
      id: 'm4', role: 'assistant', agent: 'orchestrator', time: at(292), done: null,
      parts: [
        { type: 'text', text: 'Handing the board change to the PCB agent; J3 goes to the bottom edge.' },
        tool('task', { subagent_type: 'pcb', description: 'Move J3 to the board edge' }, { status: 'running', start: at(300), session: 'ses_pcb' }),
      ],
    },
  ],
};

const CAD = {
  id: 'ses_cad', parentID: 'ses_root', title: 'Snap-fit lid, 1.6 mm walls', agent: 'cad', state: 'done', truncated: false,
  messages: [
    { id: 'c1', role: 'user', agent: null, time: at(40), done: at(40), parts: [{ type: 'text', text: 'Make the lid of enclosure-v3 snap-fit; PETG, 1.6 mm walls.' }] },
    {
      id: 'c2', role: 'assistant', agent: 'cad', time: at(41), done: at(260),
      parts: [
        tool('cad_model_source', { model: 'enclosure-v3' }, { start: at(42), end: at(43), output: '# build123d\nwall = 2.0\n…' }),
        tool('cad_model_build', { model: 'enclosure-v3', wait: true }, { start: at(120), end: at(250), output: 'built in 41 s, #2 in line before it ran' }),
        { type: 'text', text: 'Lid rebuilt: 4 snap hooks, 0.3 mm clearance, walls 1.6 mm. The build is green.' },
      ],
    },
  ],
};

const CATALOG = {
  version: '2.4.0',
  count: 6,
  agents: [
    { id: 'orchestrator', server: 'workbench', name: 'Orchestrator' },
    { id: 'cad', server: 'cad', name: '3D room' },
    { id: 'pcb', server: 'pcb', name: 'PCB room' },
  ],
  groups: [
    { name: 'Rooms and questions', tools: [
      { name: 'say', description: 'Write a line in a room, as the agent working there.', agents: ['orchestrator', 'cad', 'pcb'],
        params: [{ name: 'room', type: 'enum', enum: ['cad', 'pcb', 'firmware'], description: 'which room', required: true },
                 { name: 'text', type: 'string', enum: null, description: 'what to say', required: true }] },
      { name: 'ask', description: 'Ask the person a question with choices; the answer comes back in the room.', agents: ['orchestrator'],
        params: [{ name: 'question', type: 'string', enum: null, description: 'the question', required: true }] },
    ] },
    { name: 'Notes and the queue', tools: [
      { name: 'notes', description: 'The notes waiting in the queue, newest first.', agents: ['orchestrator'], params: [] },
    ] },
    { name: 'Builds and pictures', tools: [
      { name: 'model_build', description: 'Build a model; waits its turn in the job pool and says its place in line.', agents: ['cad'],
        params: [{ name: 'model', type: 'string', enum: null, description: 'the model id', required: true },
                 { name: 'wait', type: 'boolean', enum: null, description: 'wait until it is built', required: false }] },
      { name: 'board_step', description: 'Run one step of a board: layout, route, DRC.', agents: ['pcb'],
        params: [{ name: 'step', type: 'enum', enum: ['layout', 'route', 'drc'], description: 'which step', required: true }] },
      { name: 'render', description: 'A picture of a model or a board, taken by the server.', agents: ['cad', 'pcb'],
        params: [{ name: 'target', type: 'string', enum: null, description: 'model:<id> or board:<id>', required: true }] },
    ] },
  ],
};

const LIVE = 'J3 is on the bottom edge now; the PCB agent is routing the GND pour, then a DRC run. I will answer in PCB Design when it is clean.';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Answers an Orchestrator route; false when the path is not one. */
export function handleOrchestrator(req, res, p, body) {
  if (p === '/api/mcp/tools') return json(res, 200, CATALOG), true;
  if (p === '/api/me/llm/agent' && req.method === 'PUT') {
    const got = JSON.parse(body.toString() || '{}');
    state.choice = { provider_id: got.provider_id, model: got.model };
    return json(res, 200, { agent: state.choice }), true;
  }
  if (!p.startsWith('/api/me/orchestrator')) return false;
  const rest = p.slice('/api/me/orchestrator'.length);
  if (rest === '') return json(res, 200, status()), true;
  if (rest === '/start' && req.method === 'POST') {
    state.desired = 'running';
    state.halted = null;
    return json(res, 200, status()), true;
  }
  if (rest === '/stop' && req.method === 'POST') {
    state.desired = 'stopped';
    return json(res, 200, status()), true;
  }
  if (rest === '/tree') return json(res, 200, TREE), true;
  if (rest.startsWith('/sessions/')) {
    const sid = decodeURIComponent(rest.slice('/sessions/'.length));
    const tx = sid === 'ses_root' ? ROOT : sid === 'ses_cad' ? CAD : null;
    return json(res, 200, tx ?? { messages: [], truncated: false, reason: 'no_such_session' }), true;
  }
  if (rest === '/events') {
    if (state.desired !== 'running') return json(res, 404, { detail: 'no Orchestrator yet' }), true;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    // Asked quietly (?via=s2) while live streams are on: the events go to the account's `orch` stream.
    const quiet = new URL(req.url, 'http://x').searchParams.get('via') === 's2' && process.env.MOCK_S2 !== '0';
    const raw = (e) => !res.writableEnded && res.write(`data: ${JSON.stringify(e)}\n\n`);
    const lens = {};
    const send = (e) => {
      if (res.writableEnded) return;
      if (!quiet) return raw(e);
      // As backend orchestrator/live.py mark(): a delta says where it goes in its part.
      if (e.type === 'part' && e.part?.text != null) lens[e.id] = e.part.text.length;
      if (e.type === 'delta') {
        e = { ...e, o: lens[e.part] ?? 0 };
        lens[e.part] = (lens[e.part] ?? 0) + e.delta.length;
      }
      publish('orch', e);
    };
    raw(quiet ? { type: 'hello', via: 's2' } : { type: 'hello' });
    raw({ type: 'connected' });
    const words = LIVE.split(/(?<= )/);
    let i = 0;
    const mid = `m5_${Date.now()}`;
    const start = setTimeout(() => {
      send({ type: 'message', session: 'ses_root', id: mid, role: 'assistant', agent: 'orchestrator', time: Date.now() });
      send({ type: 'part', session: 'ses_root', message: mid, id: 'p_think', part: { type: 'reasoning', text: 'The pcb agent moved J3; DRC is next.' } });
    }, 300);
    let timer = null;
    const begin = setTimeout(() => {
      timer = setInterval(() => {
        if (i >= words.length) return clearInterval(timer);
        send({ type: 'delta', session: 'ses_root', message: mid, part: 'p_text', delta: words[i++] });
      }, 90);
    }, 600);
    const ping = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearTimeout(start);
      clearTimeout(begin);
      clearInterval(timer);
      clearInterval(ping);
    });
    return true;
  }
  return false;
}

// ---- the rooms (backend/chat.py): a long PCB thread to page through, ten lines at a time ----
const ROOM_LINES = { cad: [], pcb: [], firmware: [] };
for (let i = 0; i < 34; i++) {
  const agent = i % 2 === 1;
  ROOM_LINES.pcb.push({
    _id: `pcb${String(i).padStart(3, '0')}`,
    at: new Date(T0 - (34 - i) * 120_000).toISOString(),
    role: agent ? 'agent' : 'user',
    text: agent ? `Line ${i}: done - the change is on the board, DRC clean.` : `Line ${i}: move the next connector a little further in.`,
    room: 'pcb',
    by: agent ? { type: 'agent', name: 'agent' } : { id: 'u1', name: 'Ada Demir', type: 'user' },
    seen_at: new Date(T0).toISOString(),
  });
}

/** GET /api/chat/rooms, GET /api/chat?room=&limit=&before=, POST /api/chat; false for any other path. */
export function handleRooms(req, res, p, url, body) {
  if (p === '/api/chat/rooms') {
    return json(res, 200, Object.entries(ROOM_LINES).map(([room, ls]) => ({
      room, count: ls.length, waiting: 0, urgent: 0,
      last: ls.length ? { role: ls.at(-1).role, text: ls.at(-1).text, at: ls.at(-1).at, by: null } : null,
      agent_at: ls.filter((l) => l.role === 'agent').map((l) => l.at),
    }))), true;
  }
  if (p !== '/api/chat') return false;
  const room = url.searchParams.get('room') || 'cad';
  const ls = ROOM_LINES[room] || [];
  if (req.method === 'POST') {
    const got = JSON.parse(body.toString() || '{}');
    const line = { _id: `n${Date.now()}`, at: new Date().toISOString(), role: 'user', text: got.text, room: got.room,
                   by: { id: 'u1', name: 'Ada Demir', type: 'user' }, seen_at: null };
    const lines = ROOM_LINES[got.room] || ROOM_LINES.cad;
    lines.push(line);
    publish('bus', { k: 'line', p: { room: got.room, what: 'line' }, t: Date.now() });
    // The agent reads it and answers a moment later; the bus says so (the app reads the room at once).
    setTimeout(() => {
      line.seen_at = new Date().toISOString();
      lines.push({ _id: `a${Date.now()}`, at: new Date().toISOString(), role: 'agent', text: `On it: ${got.text}`,
                   room: got.room, by: { type: 'agent', name: 'agent' }, seen_at: null });
      publish('bus', { k: 'line', p: { room: got.room, what: 'line' }, t: Date.now() });
    }, 1500);
    return json(res, 200, line), true;
  }
  const limit = Number(url.searchParams.get('limit') || 200);
  const before = url.searchParams.get('before');
  let rows = ls;
  if (before) {
    const at = rows.findIndex((l) => l._id === before);
    rows = at >= 0 ? rows.slice(0, at) : [];
  }
  const out = limit ? rows.slice(-limit) : rows;
  // Slow enough for the loader at the top to be seen.
  return setTimeout(() => json(res, 200, out), before ? 700 : 0), true;
}

// ---- Analytics (1.5.7): the routes the web app's Chat cards and Settings read ----
const DAY = 86_400_000;
const isoDay = (i) => new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
const wave = (i, a, b) => Math.round(a + b * (0.5 + 0.5 * Math.sin(i * 1.3)) * (i % 5 === 3 ? 0.2 : 1));

export function handleAnalytics(req, res, p, url) {
  if (p === '/api/llm/summary') {
    const days = 14;
    const by_day = Array.from({ length: days }, (_, k) => {
      const i = days - 1 - k;
      const or = wave(i, 20_000, 160_000);
      const an = wave(i + 2, 5_000, 60_000);
      return { day: isoDay(i), calls: Math.round((or + an) / 4000), tokens: or + an, cost_usd: (or + an) / 400_000, by: { openrouter: or, anthropic: an } };
    });
    return json(res, 200, {
      days, t0: 0, step: DAY / 1000,
      month: { calls: 1840, input: 6_100_000, output: 1_300_000, tokens: 7_400_000, cost_usd: 18.42, unpriced_calls: 0, providers: 2 },
      today: { calls: 46, tokens: by_day.at(-1).tokens, cost_usd: 0.61, answers: 12 },
      answers: { n: 120, tps_median: 64, ttft_ms_median: 820 },
      by_day,
      providers: [{ id: 'openrouter', name: 'OpenRouter' }, { id: 'anthropic', name: 'Anthropic' }],
    }), true;
  }
  if (p === '/api/llm/usage') {
    const n = 30;
    const step = DAY / 1000;
    const t0 = Math.floor((Date.now() - (n - 1) * DAY) / 1000);
    const models = ['anthropic/claude-sonnet-4.5', 'openai/gpt-5', 'anthropic/claude-haiku-4.5', 'qwen/qwen3-coder'];
    const cost = models.map((m, j) => ({ name: m, values: Array.from({ length: n }, (_, i) => (wave(i + j * 3, 0, 100) / 100) * [0.9, 0.5, 0.15, 0.08][j]) }));
    return json(res, 200, {
      provider: 'all', days: n, step,
      totals: { calls: 1840, input: 6_100_000, output: 1_300_000, cost_usd: 18.42, unpriced_calls: 12 },
      by_provider: [
        { name: 'OpenRouter', calls: 1310, input: 4_300_000, output: 900_000, cost_usd: 12.1 },
        { name: 'Anthropic', calls: 530, input: 1_800_000, output: 400_000, cost_usd: 6.32 },
      ],
      by_model: [
        { name: 'anthropic/claude-sonnet-4.5', calls: 820, input: 0, output: 0, cost_usd: 11.2 },
        { name: 'openai/gpt-5', calls: 410, input: 0, output: 0, cost_usd: 5.1 },
        { name: 'anthropic/claude-haiku-4.5', calls: 450, input: 0, output: 0, cost_usd: 1.6 },
        { name: 'qwen/qwen3-coder', calls: 160, input: 0, output: 0, cost_usd: 0.52 },
      ],
      by_kind: [],
      calls: { t0, step, n, series: [] },
      tokens: { t0, step, n, series: [] },
      cost: { t0, step, n, series: cost },
    }), true;
  }
  if (p === '/api/cc/tools-usage') {
    // The month by day (the card shows the last 14), with the person's own Claude Code and OpenCode calls.
    const names = ['part_search', 'read_board', 'model_build', 'datasheet', 'render', 'web_search'];
    const days = Array.from({ length: 30 }, (_, k) => ({
      day: isoDay(29 - k),
      by: Object.fromEntries(names.map((t, j) => [t, Math.max(0, wave(k + j, 0, 9 - j))])),
    }));
    const lastWeek = days.slice(-7);
    const tools = Object.fromEntries(names.map((t) => {
      const week = lastWeek.reduce((a, d) => a + (d.by[t] || 0), 0);
      return [t, { uses: week * 4, done: week * 4 - 1, week, week_done: Math.max(0, week - 1) }];
    }));
    const ext = (list, scale) => {
      const byDay = Object.fromEntries(days.map((d, k) => [d.day, Object.fromEntries(list.map((t, j) => [t, Math.max(0, wave(k * 2 + j, 0, scale - 3 * j))]))]));
      const tl = Object.fromEntries(list.map((t) => [t, {
        uses: days.reduce((a, d) => a + (byDay[d.day][t] || 0), 0),
        week: lastWeek.reduce((a, d) => a + (byDay[d.day][t] || 0), 0),
      }]));
      return { tools: tl, days: byDay };
    };
    return json(res, 200, { tools, mine: 40, days, span: 'month', external: {
      claude: ext(['Bash', 'Read', 'Edit', 'Grep', 'Write', 'TodoWrite'], 22),
      opencode: ext(['bash', 'read', 'edit', 'glob'], 12),
    } }), true;
  }
  if (p === '/api/me/orchestrator/incidents') {
    return json(res, 200, { incidents: [
      { id: 'i1', at: new Date(Date.now() - 3 * 3600_000).toISOString(), kind: 'hang', code: null, signal: null, oom: false, detail: 'no answer for 10 min, restarted' },
      { id: 'i2', at: new Date(Date.now() - 26 * 3600_000).toISOString(), kind: 'credit', code: 402, signal: null, oom: false, detail: 'OpenRouter: insufficient credits' },
      { id: 'i3', at: new Date(Date.now() - 50 * 3600_000).toISOString(), kind: 'crash', code: 137, signal: 'SIGKILL', oom: true, detail: 'out of memory at 1536 MB' },
    ] }), true;
  }
  const job = (id, kind, label, state, waited, ran, who) => ({ job: id, kind, label, state, queued_at: null, started_at: null, finished_at: new Date(Date.now() - 600_000).toISOString(), waited_s: waited, ran_s: ran, who: { name: who, email: null } });
  const limits = { total: 4, queued_per_account: 6, kinds: { build: { limit: 2, running: 1, queued: 2 }, board: { limit: 1, running: 1, queued: 0 }, render: { limit: 2, running: 0, queued: 1 } } };
  if (p === '/api/pool') {
    return json(res, 200, { jobs: [job('j1', 'build', 'enclosure-v3', 'running', 12, 40, 'Ada'), job('j2', 'render', 'controller board', 'queued', 31, null, 'Ada')], running: 2, queued: 3, limits }), true;
  }
  if (p === '/api/admin/pool') {
    return json(res, 200, { jobs: [], running: 2, queued: 3, limits, recent: [
      job('r1', 'build', 'enclosure-v3', 'done', 4, 41, 'Ada Demir'), job('r2', 'board', 'controller', 'done', 95, 30, 'Bora Kaya'),
      job('r3', 'render', 'lid, 4 views', 'done', 2, 12, 'Ada Demir'), job('r4', 'build', 'fan duct', 'failed', 40, 8, 'Cem Ak'),
    ] }), true;
  }
  if (p === '/api/admin/sandboxes') {
    return json(res, 200, { running: 2, max_running: 6, sandboxes: [
      { id: 's1', name: 'Ada Demir', email: 'ada@example.com', env_name: 'main', state: 'running', usage: { cpu_pct: 12, mem_mb: 1800, disk_mb: 4000 }, last_active: new Date().toISOString() },
      { id: 's2', name: 'Bora Kaya', email: null, env_name: 'pcb', state: 'running', usage: { cpu_pct: 3, mem_mb: 900, disk_mb: 2000 }, last_active: new Date().toISOString() },
      { id: 's3', name: 'Cem Ak', email: null, env_name: null, state: 'stopped', usage: { cpu_pct: 0, mem_mb: 0, disk_mb: 800 }, last_active: null },
    ] }), true;
  }
  return false;
}
