/**
 * A made-up Workbench server for trying the app and taking its screenshots
 * without an account: the routes the app uses, answering as the real server
 * does (backend/cc_chat.py). Used by `MOCK=1 node scripts/dev-proxy.mjs`.
 * MOCK_HOLD=1 keeps an answer's stream open half-written (for screenshots).
 * MOCK_UPDATE=1 offers a newer Android build than this one at
 * /api/public/m/app.json (Account's update), else the same one.
 * MOCK_SIGNIN=1 starts signed out; the password "mock" signs in, any other
 * gets a wrong-password answer (for the sign-in screenshots).
 * An answer starts after a short wait (the typing dots), runs two tools
 * (`steps` events), then writes its text a word at a time.
 * Conversations can be archived, deleted into the trash and restored; Files
 * (scripts/mock-files.mjs) has My files, In the app and Deleted files.
 * Live streams (scripts/mock-s2.mjs, MOCK_S2=0 for none): the account's bus
 * tells of room lines and conversation changes, an answer's pieces also go
 * to its `chat-<id>` stream, the Orchestrator's events to `orch`.
 * Claude sessions (scripts/mock-wbc.mjs): three of Ada's Claude Code runs.
 * OpenCode sessions and the list's pins and folds (scripts/mock-wbo.mjs).
 */
import { Buffer } from 'node:buffer';

import { addExport, handleFiles } from './mock-files.mjs';
import { handleAnalytics, handleOrchestrator, handleRooms } from './mock-orchestrator.mjs';
import { activityNow, handleS2Api, publish } from './mock-s2.mjs';
import { handleWbc } from './mock-wbc.mjs';
import { handleWbo } from './mock-wbo.mjs';

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const me = { id: 'u1', name: 'Ada Demir', email: 'ada@example.com' };
const MODEL = 'anthropic/claude-sonnet-4.5';

const ANSWER = `## Why the 3.3 V rail sags

The regulator is fine; the drop comes from the **ferrite bead** in series with it. At the radio's transmit burst it carries about 380 mA, and its DC resistance adds up:

1. Bead DCR: 0.25 ohm, so 95 mV lost at 380 mA
2. Trace from \`U4\` to the module: about 20 mV more
3. Bulk capacitance near the module is only 10 uF

Measure at \`TP7\` while the radio sends, then try a bead rated for 1 A:

\`\`\`text
BLM18PG221SN1  220 ohm @ 100 MHz, 1.4 A, 0.05 ohm DCR
\`\`\`

Adding a 47 uF capacitor next to the module's supply pin also helps.`;

// The tools the answer above ran, where they ran in it (backend/ccgen.py steps).
const STEPS = [
  {
    id: 's1',
    tool: 'read_board',
    status: 'done',
    pos: 0,
    say: 'Reading the board {name}',
    vars: { name: 'Sensor board rev C' },
    summary: '42 parts, 3 power rails; U4 (AP2112K-3.3) feeds the radio module through FB2.',
  },
  {
    id: 's2',
    tool: 'part_search',
    status: 'done',
    pos: ANSWER.indexOf('Measure at'),
    say: 'Looking up {query}',
    vars: { query: 'ferrite bead 0603 1 A' },
    summary: 'Murata BLM18PG221SN1: 0603, 1.4 A, 50 mOhm DCR, in stock.',
  },
];

const chats = [
  {
    id: 'c1',
    title: '3.3 V rail sag',
    provider: 'openrouter',
    model: MODEL,
    by: me,
    created_at: ago(95),
    updated_at: ago(12),
    count: 2,
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'The 3.3 V rail on the sensor board drops to 3.05 V when the radio transmits. Is the LDO too small?',
        at: ago(14),
        by: { ...me, type: 'user' },
      },
      { id: 'm2', role: 'assistant', content: ANSWER, at: ago(12), provider: 'openrouter', model: MODEL, steps: STEPS },
    ],
  },
  {
    id: 'c0',
    title: 'Sensor board bring-up',
    pinned: true,
    last: { role: 'assistant', text: 'All rails are within 2 percent; the next step is the radio.' },
    count: 14,
    updated_at: ago(60 * 24 * 5),
  },
  {
    id: 'c7',
    title: 'USB-C PD negotiation',
    last: { role: 'assistant', text: 'The sink asks for 9 V only after the 5 V contract is in place.' },
    count: 5,
    updated_at: ago(60 * 5),
  },
  {
    id: 'c8',
    title: 'Thermal relief on GND pours',
    last: { role: 'assistant', text: 'Four spokes of 0.3 mm are enough for hand soldering the connector.' },
    count: 4,
    updated_at: ago(60 * 24 * 2),
  },
  {
    id: 'c2',
    title: 'Enclosure wall thickness',
    last: {
      role: 'assistant',
      text: 'For PETG at 0.4 mm nozzle, 1.6 mm walls (four perimeters) are a good start for the snap fits.',
    },
    count: 6,
    updated_at: ago(70),
  },
  {
    id: 'c3',
    title: 'Firmware OTA rollback',
    last: { role: 'user', text: 'What happens if power is lost while the new image is being written?', by: 'Kerem' },
    count: 9,
    updated_at: ago(60 * 26),
  },
  {
    id: 'c4',
    title: 'BOM cost for 500 units',
    last: {
      role: 'assistant',
      text: 'At 500 units the connectors are 31 percent of the BOM; the JST alternatives bring it down.',
    },
    count: 4,
    updated_at: ago(60 * 24 * 3),
  },
  {
    id: 'c5',
    title: 'I2C pull-up values',
    last: {
      role: 'assistant',
      text: 'With 180 pF of bus capacitance at 400 kHz, 2.2 k pull-ups keep the rise time under 300 ns.',
    },
    count: 3,
    updated_at: ago(60 * 24 * 9),
  },
  {
    id: 'c6',
    title: 'Stepper driver heat',
    last: {
      role: 'assistant',
      text: 'Lower the hold current to 40 percent; the motor keeps position and the driver runs 18 C cooler.',
    },
    count: 12,
    updated_at: ago(60 * 24 * 40),
  },
  {
    id: 'a1',
    title: 'Old enclosure, rev A',
    archived: true,
    last: { role: 'assistant', text: 'Rev A walls were 1.2 mm; the snap fits cracked.' },
    count: 8,
    updated_at: ago(60 * 24 * 21),
  },
  {
    id: 'a2',
    title: 'Supplier quotes, spring',
    archived: true,
    last: { role: 'assistant', text: 'JLC was cheapest at 100 units.' },
    count: 6,
    updated_at: ago(60 * 24 * 60),
  },
  {
    id: 'a3',
    title: 'LoRa range test',
    archived: true,
    pinned: true,
    last: { role: 'assistant', text: '2.1 km line of sight at SF9.' },
    count: 11,
    updated_at: ago(60 * 24 * 33),
  },
  {
    id: 't1',
    title: 'Scratch: resistor dividers',
    deleted_at: ago(60 * 24),
    last: { role: 'assistant', text: '' },
    count: 2,
    updated_at: ago(60 * 24 * 2),
  },
  {
    id: 't2',
    title: 'Test conversation',
    deleted_at: ago(60 * 24 * 12),
    last: { role: 'assistant', text: '' },
    count: 1,
    updated_at: ago(60 * 24 * 13),
  },
].map((c) => ({ provider: 'openrouter', model: MODEL, by: me, created_at: c.updated_at, ...c }));

/** Whole days left in the trash, as the server counts them (30 from when it was deleted). */
function inTrash(c) {
  const left = 30 - (Date.now() - new Date(c.deleted_at).getTime()) / 86_400_000;
  return {
    ...c,
    purge_at: new Date(Date.now() + left * 86_400_000).toISOString(),
    days_left: Math.max(0, Math.ceil(left)),
  };
}

const MODELS = [
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', context: 200000 },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', context: 200000, cheap: true },
  { id: 'openai/gpt-5', name: 'GPT-5', context: 400000 },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', context: 1000000 },
  { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', context: 262000 },
];

const STREAM = `Short answer: yes, for that load a 1 A bead is the safer part.

- Keep the **47 uF** capacitor within 5 mm of the module
- Re-measure the dip at \`TP7\` after the change

If the dip stays above 150 mV, the next suspect is the`;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
  });
}

let signedIn = process.env.MOCK_SIGNIN !== '1';
const sessions = new Map();
/** Who an address signs in as: Ada for hers (or none), anyone else by their address. */
function personOf(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || e === me.email) return me;
  const name = e.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { id: `u-${e}`, name, email: e };
}

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const body = await readBody(req);
  if (req.method !== 'GET' && req.headers['x-redline-csrf'] !== '1') {
    return json(res, 403, { detail: 'that change did not come from the app' });
  }
  if (p === '/api/health') return json(res, 200, { ok: true, db: 'mock' });
  if (handleS2Api(req, res, p, body)) return;
  if (p === '/api/me/activity/now') return json(res, 200, activityNow());
  if (p === '/api/public/m/app.json') {
    const newer = process.env.MOCK_UPDATE === '1';
    return json(res, 200, {
      version: newer ? '1.6.2' : '1.6.1',
      versionCode: newer ? 20 : 19,
      size: 39_800_000,
      sha256: '0'.repeat(64),
      published_at: ago(60),
      min_sdk: 24,
      min_android: '7.0',
      abis: ['arm64-v8a'],
      file: newer ? 'workbench-1.6.2.apk' : 'workbench-1.6.1.apk',
      url: '/api/public/m/app.apk',
      ...(newer
        ? {
            notes: {
              en: 'Faster drawer.\nUpdates from Account.',
              tr: 'Daha hızlı çekmece.\nGüncellemeler Hesap ekranından.',
            },
          }
        : {}),
    });
  }
  // An app's sessions (X-Workbench-Session, 1.5.6): one per account signed in as an app.
  const tok = req.headers['x-workbench-session'];
  if (p === '/api/auth/state') {
    const user = tok ? (sessions.get(tok) ?? null) : signedIn ? me : null;
    return json(res, 200, {
      mode: 'on',
      needs_setup: false,
      user,
      role: user ? 'owner' : null,
      can: user ? ['view', 'draw', 'run', 'edit', 'delete', 'tokens', 'space', 'settings', 'users'] : [],
      must_change_password: false,
    });
  }
  if (p === '/api/auth/login') {
    const got = JSON.parse(body.toString() || '{}');
    if (process.env.MOCK_SIGNIN === '1' && got.password !== 'mock') {
      return json(res, 401, { detail: 'Wrong email address or password.' });
    }
    const user = personOf(got.email);
    if (got.app) {
      const session = `mock${sessions.size + 1}x${Date.now().toString(36)}`;
      sessions.set(session, user);
      return json(res, 200, { user, remembered: false, session });
    }
    signedIn = true;
    return json(res, 200, { user: me, remembered: false });
  }
  if (p === '/api/auth/app-session' && req.method === 'POST') {
    const user = tok ? sessions.get(tok) : signedIn ? me : null;
    if (!user) return json(res, 401, { detail: 'sign in first' });
    const session = `mock${sessions.size + 1}x${Date.now().toString(36)}`;
    sessions.set(session, user);
    return json(res, 200, { session });
  }
  if (p === '/api/auth/logout') {
    if (tok) sessions.delete(tok);
    else signedIn = false;
    return json(res, 200, { signed_out: true });
  }
  if (p === '/api/cc/ideas') {
    return json(res, 200, {
      source: 'llm',
      on: true,
      at: ago(30),
      refreshing: false,
      every: 24,
      count: 4,
      start: { provider: 'openrouter', model: MODEL },
      items: [
        { kind: 'pcb', text: 'Why does the 3.3 V rail on the sensor board sag when the radio sends?' },
        { kind: 'firmware', text: 'Add a watchdog to the OTA updater so a failed image rolls back.' },
        { kind: 'cad', text: 'Make the enclosure lid snap-fit with 1.6 mm PETG walls.' },
        { kind: 'manufacturers', text: 'Which ferrite beads in 0603 carry 1 A with under 0.1 ohm?' },
      ],
    });
  }
  if (p === '/api/cc/chats' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const trashed = url.searchParams.get('trash') === '1';
    const archived = url.searchParams.get('archived') === '1';
    if (trashed) {
      return json(
        res,
        200,
        chats
          .filter((c) => c.deleted_at && (!q || c.title.toLowerCase().includes(q)))
          .sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
          .map(({ messages, ...c }) => inTrash(c)),
      );
    }
    const shown = chats
      .filter((c) => !c.deleted_at && !!c.archived === archived)
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          (c.messages || []).some((m) => m.content.toLowerCase().includes(q)) ||
          (c.last?.text || '').toLowerCase().includes(q),
      )
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated_at.localeCompare(a.updated_at));
    return json(
      res,
      200,
      shown.map(({ messages, ...c }) => {
        const last = messages?.at(-1);
        return last ? { ...c, last: { role: last.role, text: last.content.slice(0, 140) } } : c;
      }),
    );
  }
  if (p === '/api/cc/chats' && req.method === 'POST') {
    const said = JSON.parse(body.toString() || '{}');
    const c = {
      id: `n${Date.now()}`,
      title: 'New conversation',
      provider: said.provider || 'openrouter',
      model: said.model || MODEL,
      by: me,
      created_at: ago(0),
      updated_at: ago(0),
      count: 0,
      messages: [],
    };
    chats.unshift(c);
    publish('bus', { k: 'cc', p: { id: c.id, what: 'new' }, t: Date.now() });
    return json(res, 200, c);
  }
  if (p === '/api/llm/settings') {
    return json(res, 200, {
      providers: {
        openrouter: { name: 'OpenRouter', set: true },
        claude: { name: 'Claude API', set: true },
        commandcode: { name: 'Command Code', set: false },
      },
    });
  }
  if (p === '/api/llm/models')
    return json(res, 200, url.searchParams.get('provider') === 'claude' ? MODELS.slice(0, 2) : MODELS);
  if (p === '/api/voice/transcribe') {
    return json(res, 200, {
      text: 'Check whether the ferrite bead on the 3.3 V rail is rated for the radio burst current, and list two parts that would fit the 0603 footprint.',
      language: 'en',
      model: 'whisper-large-v3',
      seconds: 7.4,
    });
  }
  if (p === '/api/cc/chats/empty-trash' && req.method === 'POST') {
    const n = chats.filter((c) => c.deleted_at).length;
    for (let i = chats.length - 1; i >= 0; i--) if (chats[i].deleted_at) chats.splice(i, 1);
    return json(res, 200, { deleted: n, kept: 0 });
  }
  if (p.startsWith('/api/files') && handleFiles(req, res, p, url, body)) return;
  if (handleAnalytics(req, res, p, url)) return;
  if (handleOrchestrator(req, res, p, body)) return;
  if (handleRooms(req, res, p, url, body)) return;
  if (handleWbc(req, res, p, url, body)) return;
  if (handleWbo(req, res, p, url, body)) return;
  const m = p.match(/^\/api\/cc\/chats\/([^/]+)(\/.*)?$/);
  if (m) {
    const chat = chats.find((c) => c.id === m[1]);
    if (!chat) return json(res, 404, { detail: m[1] });
    const rest = m[2] || '';
    if (rest === '/export' && req.method === 'POST') {
      const fmt = JSON.parse(body.toString() || '{}').format === 'pdf' ? 'pdf' : 'md';
      const lines = (chat.messages || []).map((x) => `## ${x.role === 'user' ? me.name : 'Answer'}\n\n${x.content}`);
      return json(res, 200, addExport(chat.id, chat.title, fmt, `# ${chat.title}\n\n${lines.join('\n\n---\n\n')}\n`));
    }
    if (rest === '/restore' && req.method === 'POST') {
      delete chat.deleted_at;
      return json(res, 200, { messages: [], ...chat });
    }
    if (!rest && req.method === 'DELETE' && url.searchParams.get('forever') === '1') {
      chats.splice(chats.indexOf(chat), 1);
      return json(res, 200, { deleted: chat.id, forever: true });
    }
    if (chat.deleted_at) return json(res, 404, { detail: m[1] });
    if (!rest && req.method === 'GET')
      return json(res, 200, { messages: [], ...chat, count: chat.messages?.length ?? chat.count });
    if (!rest && req.method === 'PATCH') {
      Object.assign(chat, JSON.parse(body.toString() || '{}'));
      return json(res, 200, chat);
    }
    if (!rest && req.method === 'DELETE') {
      chat.deleted_at = ago(0);
      return json(res, 200, { deleted: chat.id, trash: true, days: 30 });
    }
    if (rest === '/stop') {
      // An answer still being written ends here, with what it had (as the server's Stop does).
      chat.stop?.();
      return json(res, 200, { stopped: true });
    }
    if (rest === '/live') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(`data: ${JSON.stringify({ type: 'hello', live: [] })}\n\n`);
      return setTimeout(() => res.end(`data: ${JSON.stringify({ type: 'bye' })}\n\n`), 1000);
    }
    if (rest === '/messages' && req.method === 'POST') {
      const said = JSON.parse(body.toString() || '{}');
      const msgs = chat.messages || (chat.messages = []);
      const line = { id: `m${Date.now()}`, role: 'user', content: said.text, at: ago(0), by: { ...me, type: 'user' } };
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      });
      res.write(`data: ${JSON.stringify({ type: 'user', message: line, keep: msgs.length, gen: 'g1' })}\n\n`);
      msgs.push(line);
      publish('bus', { k: 'cc', p: { id: chat.id, what: 'line' }, t: Date.now() });
      // The answer's pieces go to its S2 stream too (backend ccgen.S2Pieces), a little ahead of this one.
      const lane = `chat-${chat.id.toLowerCase()}`;
      const words = STREAM.split(/(?<= )/);
      let i = 0;
      let at = 0;
      const hold = process.env.MOCK_HOLD === '1';
      const steps = [
        {
          id: 'r1',
          tool: 'measure_plan',
          status: 'running',
          pos: 0,
          say: 'Checking {name} against the burst current',
          vars: { name: 'FB2' },
        },
      ];
      const send = (ev) => {
        if (ev.type === 'steps') publish(lane, { ...ev, gen: 'g1' });
        return !res.writableEnded && res.write(`data: ${JSON.stringify(ev)}\n\n`);
      };
      let timer = null;
      const waits = [
        setTimeout(() => send({ type: 'steps', steps }), 700),
        setTimeout(() => {
          steps[0] = {
            ...steps[0],
            status: 'done',
            summary: 'FB2 is rated 500 mA; the burst draws 380 mA with 30 percent margin left.',
          };
          send({ type: 'steps', steps });
          timer = setInterval(write, 40);
        }, 1400),
      ];
      const write = () => {
        if (i >= words.length) {
          clearInterval(timer);
          if (hold) return; // left open, half-written
          const answer = {
            id: `a${Date.now()}`,
            role: 'assistant',
            content: STREAM,
            at: ago(0),
            model: chat.model,
            steps,
          };
          msgs.push(answer);
          chat.updated_at = ago(0);
          res.write(`data: ${JSON.stringify({ type: 'done', message: answer })}\n\n`);
          publish('bus', { k: 'cc', p: { id: chat.id, what: 'answer' }, t: Date.now() });
          if (chat.title === 'New conversation') {
            chat.title = said.text
              .split(/\s+/)
              .slice(0, 4)
              .join(' ')
              .replace(/[?.!,]+$/, '');
            res.write(`data: ${JSON.stringify({ type: 'title', title: chat.title })}\n\n`);
          }
          return res.end();
        }
        publish(lane, { type: 'text', gen: 'g1', text: words[i], at });
        res.write(`data: ${JSON.stringify({ type: 'text', text: words[i], at })}\n\n`);
        at += words[i].length;
        i++;
      };
      chat.stop = () => {
        clearInterval(timer);
        waits.forEach(clearTimeout);
        chat.stop = null;
        if (res.writableEnded) return;
        const answer = {
          id: `a${Date.now()}`,
          role: 'assistant',
          content: STREAM.slice(0, at),
          at: ago(0),
          model: chat.model,
          steps,
          stopped: true,
        };
        msgs.push(answer);
        res.write(`data: ${JSON.stringify({ type: 'done', message: answer })}\n\n`);
        res.end();
      };
      req.on('close', () => {
        clearInterval(timer);
        waits.forEach(clearTimeout);
      });
      return;
    }
  }
  return json(res, 404, { detail: 'Not Found' });
}
