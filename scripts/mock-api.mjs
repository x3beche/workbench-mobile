/**
 * A made-up Workbench server for trying the app and taking its screenshots
 * without an account: the routes the app uses, answering as the real server
 * does (backend/cc_chat.py). Used by `MOCK=1 node scripts/dev-proxy.mjs`.
 * MOCK_HOLD=1 keeps an answer's stream open half-written (for screenshots).
 * MOCK_SIGNIN=1 starts signed out; the password "mock" signs in, any other
 * gets a wrong-password answer (for the sign-in screenshots).
 */
import { Buffer } from 'node:buffer';

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

const chats = [
  {
    id: 'c1', title: '3.3 V rail sag', provider: 'openrouter', model: MODEL, by: me,
    created_at: ago(95), updated_at: ago(12), count: 2, pinned: true,
    messages: [
      { id: 'm1', role: 'user', content: 'The 3.3 V rail on the sensor board drops to 3.05 V when the radio transmits. Is the LDO too small?', at: ago(14), by: { ...me, type: 'user' } },
      { id: 'm2', role: 'assistant', content: ANSWER, at: ago(12), provider: 'openrouter', model: MODEL },
    ],
  },
  { id: 'c2', title: 'Enclosure wall thickness', last: { role: 'assistant', text: 'For PETG at 0.4 mm nozzle, 1.6 mm walls (four perimeters) are a good start for the snap fits.' }, count: 6, updated_at: ago(70) },
  { id: 'c3', title: 'Firmware OTA rollback', last: { role: 'user', text: 'What happens if power is lost while the new image is being written?', by: 'Kerem' }, count: 9, updated_at: ago(60 * 26) },
  { id: 'c4', title: 'BOM cost for 500 units', last: { role: 'assistant', text: 'At 500 units the connectors are 31 percent of the BOM; the JST alternatives bring it down.' }, count: 4, updated_at: ago(60 * 24 * 3) },
  { id: 'c5', title: 'I2C pull-up values', last: { role: 'assistant', text: 'With 180 pF of bus capacitance at 400 kHz, 2.2 k pull-ups keep the rise time under 300 ns.' }, count: 3, updated_at: ago(60 * 24 * 9) },
  { id: 'c6', title: 'Stepper driver heat', last: { role: 'assistant', text: 'Lower the hold current to 40 percent; the motor keeps position and the driver runs 18 C cooler.' }, count: 12, updated_at: ago(60 * 24 * 40) },
].map((c) => ({ provider: 'openrouter', model: MODEL, by: me, created_at: c.updated_at, ...c }));

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

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const body = await readBody(req);
  if (req.method !== 'GET' && req.headers['x-redline-csrf'] !== '1') {
    return json(res, 403, { detail: 'that change did not come from the app' });
  }
  if (p === '/api/health') return json(res, 200, { ok: true, db: 'mock' });
  if (p === '/api/auth/state') {
    const user = signedIn ? me : null;
    return json(res, 200, { mode: 'on', needs_setup: false, user, role: user ? 'owner' : null, must_change_password: false });
  }
  if (p === '/api/auth/login') {
    if (process.env.MOCK_SIGNIN === '1' && JSON.parse(body.toString() || '{}').password !== 'mock') {
      return json(res, 401, { detail: 'Wrong email address or password.' });
    }
    signedIn = true;
    return json(res, 200, { user: me, remembered: false });
  }
  if (p === '/api/auth/logout') {
    signedIn = false;
    return json(res, 200, { signed_out: true });
  }
  if (p === '/api/cc/chats' && req.method === 'GET') {
    return json(res, 200, chats.map(({ messages, ...c }) => {
      const last = messages?.at(-1);
      return last ? { ...c, last: { role: last.role, text: last.content.slice(0, 140) } } : c;
    }));
  }
  if (p === '/api/cc/chats' && req.method === 'POST') {
    const c = { id: `n${Date.now()}`, title: 'New conversation', provider: 'openrouter', model: MODEL, by: me, created_at: ago(0), updated_at: ago(0), count: 0, messages: [] };
    chats.unshift(c);
    return json(res, 200, c);
  }
  if (p === '/api/llm/settings') {
    return json(res, 200, { providers: { openrouter: { name: 'OpenRouter', set: true }, claude: { name: 'Claude API', set: true }, commandcode: { name: 'Command Code', set: false } } });
  }
  if (p === '/api/llm/models') return json(res, 200, url.searchParams.get('provider') === 'claude' ? MODELS.slice(0, 2) : MODELS);
  if (p === '/api/voice/transcribe') {
    return json(res, 200, {
      text: 'Check whether the ferrite bead on the 3.3 V rail is rated for the radio burst current, and list two parts that would fit the 0603 footprint.',
      language: 'en', model: 'whisper-large-v3', seconds: 7.4,
    });
  }
  const m = p.match(/^\/api\/cc\/chats\/([^/]+)(\/.*)?$/);
  if (m) {
    const chat = chats.find((c) => c.id === m[1]);
    if (!chat) return json(res, 404, { detail: m[1] });
    const rest = m[2] || '';
    if (!rest && req.method === 'GET') return json(res, 200, { messages: [], ...chat, count: chat.messages?.length ?? chat.count });
    if (!rest && req.method === 'PATCH') {
      Object.assign(chat, JSON.parse(body.toString() || '{}'));
      return json(res, 200, chat);
    }
    if (rest === '/stop') return json(res, 200, { stopped: true });
    if (rest === '/live') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(`data: ${JSON.stringify({ type: 'hello', live: [] })}\n\n`);
      return setTimeout(() => res.end(`data: ${JSON.stringify({ type: 'bye' })}\n\n`), 1000);
    }
    if (rest === '/messages' && req.method === 'POST') {
      const said = JSON.parse(body.toString() || '{}');
      const msgs = chat.messages || (chat.messages = []);
      const line = { id: `m${Date.now()}`, role: 'user', content: said.text, at: ago(0), by: { ...me, type: 'user' } };
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
      res.write(`data: ${JSON.stringify({ type: 'user', message: line, keep: msgs.length, gen: 'g1' })}\n\n`);
      msgs.push(line);
      const words = STREAM.split(/(?<= )/);
      let i = 0;
      let at = 0;
      const hold = process.env.MOCK_HOLD === '1';
      const timer = setInterval(() => {
        if (i >= words.length) {
          clearInterval(timer);
          if (hold) return; // left open, half-written
          const answer = { id: `a${Date.now()}`, role: 'assistant', content: STREAM, at: ago(0), model: chat.model };
          msgs.push(answer);
          res.write(`data: ${JSON.stringify({ type: 'done', message: answer })}\n\n`);
          return res.end();
        }
        res.write(`data: ${JSON.stringify({ type: 'text', text: words[i], at })}\n\n`);
        at += words[i].length;
        i++;
      }, 40);
      req.on('close', () => clearInterval(timer));
      return;
    }
  }
  return json(res, 404, { detail: 'Not Found' });
}
