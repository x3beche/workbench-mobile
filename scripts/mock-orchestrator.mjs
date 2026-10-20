/**
 * The made-up server's Orchestrator (backend/orchestrator): its state, its
 * sub-agent tree, two sessions' transcripts, the live stream (a new answer
 * written a few words at a time, then held open), the MCP tools, Start and
 * Stop and the model. MOCK_ORCH=halted starts it stopped for a refused key,
 * MOCK_ORCH=stopped not running. Used by scripts/mock-api.mjs.
 */
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
    const send = (e) => !res.writableEnded && res.write(`data: ${JSON.stringify(e)}\n\n`);
    send({ type: 'hello' });
    send({ type: 'connected' });
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
