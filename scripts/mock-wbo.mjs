/**
 * The made-up server's OpenCode sessions (backend/wbopencode.py's page
 * routes) and the Chat list's pins and folds (backend/session_prefs.py):
 * Ada's OpenCode runs - one ready under wb-opencode with enough messages to
 * be read ten turns at a time, thinking, tool calls, a picture sent from
 * Workbench and a question OpenCode waits on; one working under an old
 * wb-opencode with a permission asked ("Update wb-opencode"); one under
 * wb-opencode 0.1.0, which forwards no forms, whose question is drawn from
 * the tool's own call (one answered on the computer, one waiting); one ended
 * without wb-opencode (the composer is a note); a few more of the last day
 * and an old pinned one, for the drawer's fold and "Show N more".
 *
 * A line sent is queued, delivered (it becomes an OpenCode message) and
 * answered, the answer streamed on the account's S2 stream `wbo` a few
 * words at a time with their place (`o`); an answer to a question or a
 * permission goes "answering" -> answered from the Chat, and OpenCode goes
 * on. Each step is also told on the bus (`wbo`); pins and folds on `side`.
 */
import { publish } from './mock-s2.mjs';

const me = { id: 'u1', name: 'Ada Demir' };
const ms = () => Date.now();
const secs = () => Date.now() / 1000;

function bridge(over) {
  return {
    id: 'wbo-b1-ada-laptop',
    connected: true,
    remote: true,
    host: 'ada-laptop',
    platform: 'linux',
    version: '0.2.0',
    opencode: '2.1.2',
    cwd: '~/projects/sensor-board',
    model: 'deepseek/deepseek-v4-flash',
    seen: secs(),
    started: secs() - 3600,
    latest: '0.2.0',
    outdated: false,
    answers: true,
    ...over,
  };
}

function row(id, name, over = {}) {
  return {
    session_id: id,
    title: name,
    name,
    status: 'idle',
    asking: false,
    directory: '~/projects/sensor-board',
    computer: 'ada-laptop',
    updated: ms() - 60_000,
    seen: secs(),
    created: secs() - 7200,
    parent: null,
    tokens: { input: 18_400, output: 2_100 },
    mine: true,
    owner: me,
    bridge: null,
    may_send: false,
    why: 'no-bridge',
    ...over,
  };
}

// A small board picture, as the phone sends one (a 1x1 PNG would do; the shots send their own).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

/** The first session: twelve earlier exchanges, then one with tools and a question. */
function railMsgs() {
  const t0 = ms() - 3 * 3600_000;
  const out = [];
  const topics = ['LDO', 'ferrite bead', 'bulk caps', 'return trace'];
  for (let i = 0; i < 12; i++) {
    const at = t0 + i * 300_000;
    out.push({
      id: `msg_u${String(i).padStart(3, '0')}`,
      role: 'user',
      time: at,
      done: at,
      parts: [{ id: 't0', type: 'text', text: `Step ${i + 1}: check the ${topics[i % 4]} again` }],
    });
    out.push({
      id: `msg_a${String(i).padStart(3, '0')}`,
      role: 'assistant',
      agent: 'build',
      model: 'deepseek/deepseek-v4-flash',
      time: at + 2000,
      done: at + 14_000,
      parts: [
        {
          id: 't0',
          type: 'text',
          text: `Step ${i + 1} done: the ${topics[i % 4]} looks **fine**; next is step ${i + 2}.`,
        },
      ],
    });
  }
  const at = ms() - 20 * 60_000;
  out.push({
    id: 'msg_u100',
    role: 'user',
    time: at,
    done: at,
    parts: [
      { id: 't0', type: 'text', text: 'Here is the board. Why does the 3V3 rail sag under the radio burst?' },
      { id: 'f0', type: 'file', text: 'board.png' },
    ],
  });
  out.push({
    id: 'msg_a100',
    role: 'assistant',
    agent: 'build',
    model: 'deepseek/deepseek-v4-flash',
    time: at + 3000,
    done: at + 41_000,
    parts: [
      {
        id: 'r0',
        type: 'reasoning',
        text: 'The burst draws ~380 mA. The bead FB2 sits in series with the LDO output; its DC resistance matters more than its impedance here.',
      },
      {
        id: 'call_read01',
        type: 'tool',
        tool: 'read',
        status: 'completed',
        title: 'hw/power.kicad_sch',
        input: '{"filePath":"hw/power.kicad_sch"}',
        output: 'U3 AP2112K-3.3, FB2 BLM18PG471SN1, C12 10uF',
        start: at + 6000,
        end: at + 6400,
      },
      {
        id: 'call_grep01',
        type: 'tool',
        tool: 'grep',
        status: 'completed',
        title: 'FB2',
        output: 'hw/power.kicad_sch:412: FB2',
        start: at + 7000,
        end: at + 7300,
      },
      {
        id: 'call_bash01',
        type: 'tool',
        tool: 'bash',
        status: 'completed',
        title: 'kicad-cli sch erc hw/power.kicad_sch',
        output: '0 errors, 2 warnings',
        start: at + 8000,
        end: at + 11_200,
      },
      {
        id: 't0',
        type: 'text',
        text: 'The dip lines up with **FB2**: at 380 mA its 0.2 ohm drops about 76 mV.\n\n1. Swap FB2 for `BLM18PG221SN1` (0.05 ohm)\n2. Add 47 uF next to the radio module',
      },
    ],
  });
  const at2 = ms() - 6 * 60_000;
  out.push({
    id: 'msg_u101',
    role: 'user',
    time: at2,
    done: at2,
    parts: [{ id: 't0', type: 'text', text: 'Change it on the schematic' }],
  });
  out.push({
    id: 'msg_a101',
    role: 'assistant',
    agent: 'build',
    model: 'deepseek/deepseek-v4-flash',
    time: at2 + 2000,
    done: null,
    parts: [
      { id: 't0', type: 'text', text: 'Two ways to do it - I will ask which you prefer.' },
      { id: 'call_ask01', type: 'tool', tool: 'question', status: 'running', title: '', start: at2 + 5000 },
    ],
  });
  return out;
}

const SESSIONS = [
  {
    row: row('ses_rail0000a1', 'Sensor board rail sag', {
      status: 'waiting',
      asking: true,
      updated: ms() - 30_000,
      bridge: bridge({}),
      may_send: true,
      why: '',
    }),
    msgs: railMsgs(),
    sends: [
      {
        id: 'a1b2c3d4e5f60708',
        text: 'Here is the board. Why does the 3V3 rail sag under the radio burst?',
        by: me,
        status: 'delivered',
        error: '',
        at: secs() - 1200,
        updated: secs() - 1199,
        delivered_at: secs() - 1199,
        inbox: 'msg_u100',
        images: [{ n: 0, type: 'image/png', bytes: 70 }],
        images_gone: false,
      },
    ],
    asks: [
      {
        id: 'frm_ask0000a1',
        kind: 'form',
        form_kind: 'question',
        title: '',
        part: 'call_ask01',
        message: 'msg_a101',
        status: 'pending',
        at: secs() - 300,
        settled_at: null,
        fields: [
          {
            key: 'q0',
            type: 'string',
            title: 'Bead',
            description: 'Which change should go on the schematic?',
            custom: true,
            required: true,
            options: [
              { value: 'swap', label: 'Swap FB2', description: 'BLM18PG221SN1, 0.05 ohm, same footprint' },
              { value: 'bypass', label: 'Bypass FB2', description: 'A 0 ohm link; loses the filtering' },
            ],
          },
          {
            key: 'q1',
            type: 'multiselect',
            title: 'Also',
            description: 'Anything else to change while at it?',
            custom: false,
            required: false,
            options: [
              { value: 'cap', label: 'Add 47 uF', description: 'next to the radio module' },
              { value: 'erc', label: 'Run ERC again', description: '' },
            ],
          },
        ],
      },
      {
        id: 'per_old0000a1',
        kind: 'permission',
        action: 'bash',
        resources: ['kicad-cli sch erc hw/power.kicad_sch'],
        save: ['kicad-cli *'],
        part: 'call_bash01',
        message: 'msg_a100',
        status: 'replied',
        decision: 'always',
        via: 'computer',
        at: secs() - 1100,
        settled_at: secs() - 1090,
      },
    ],
  },
  {
    row: row('ses_ota00000b2', 'OTA rollback watchdog', {
      status: 'waiting',
      asking: true,
      computer: 'workstation',
      directory: '~/fw/ota',
      updated: ms() - 15_000,
      bridge: bridge({
        id: 'wbo-b2-workstation',
        host: 'workstation',
        version: '0.2.0',
        latest: '0.2.1',
        outdated: true,
        cwd: '~/fw/ota',
      }),
      may_send: true,
      why: '',
    }),
    msgs: [
      {
        id: 'msg_o1',
        role: 'user',
        time: ms() - 300_000,
        done: ms() - 300_000,
        parts: [
          {
            id: 't0',
            type: 'text',
            text: 'Add a watchdog to the OTA updater so a failed image rolls back, and flash it.',
          },
        ],
      },
      {
        id: 'msg_o2',
        role: 'assistant',
        model: 'anthropic/claude-sonnet-4-5',
        time: ms() - 298_000,
        done: null,
        parts: [
          { id: 'r0', type: 'reasoning', text: 'A boot counter in RTC memory; three failed boots roll back.' },
          {
            id: 'call_edit01',
            type: 'tool',
            tool: 'edit',
            status: 'completed',
            title: 'main/ota_guard.c',
            output: '+42 -3',
            start: ms() - 290_000,
            end: ms() - 289_500,
          },
          { id: 't0', type: 'text', text: 'I added `ota_guard()`. Now flashing the board.' },
          {
            id: 'call_flash1',
            type: 'tool',
            tool: 'bash',
            status: 'running',
            title: 'idf.py -p /dev/ttyUSB0 flash',
            start: ms() - 20_000,
          },
        ],
      },
    ],
    sends: [],
    asks: [
      {
        id: 'per_flash00b2',
        kind: 'permission',
        action: 'bash',
        resources: ['idf.py -p /dev/ttyUSB0 flash'],
        save: ['idf.py *'],
        part: 'call_flash1',
        message: 'msg_o2',
        status: 'pending',
        at: secs() - 20,
        settled_at: null,
      },
    ],
  },
  {
    row: row('ses_pwr00000f1', 'Power budget estimate', {
      status: 'busy',
      computer: 'lab-pc',
      directory: '~/projects/power',
      updated: ms() - 30_000,
      bridge: bridge({
        id: 'wbo-b3-lab-pc',
        host: 'lab-pc',
        version: '0.1.0',
        opencode: '2.0.18',
        cwd: '~/projects/power',
        outdated: true,
        answers: false,
      }),
      may_send: true,
      why: '',
    }),
    msgs: [
      {
        id: 'msg_p1',
        role: 'user',
        time: ms() - 600_000,
        done: ms() - 600_000,
        parts: [
          { id: 't0', type: 'text', text: 'Estimate the battery life of the sensor node and ask me what you need.' },
        ],
      },
      {
        id: 'msg_p2',
        role: 'assistant',
        model: 'deepseek/deepseek-v4-flash',
        time: ms() - 598_000,
        done: null,
        parts: [
          {
            id: 'call_qa01',
            type: 'tool',
            tool: 'question',
            status: 'completed',
            input: JSON.stringify({
              questions: [
                {
                  header: 'Battery',
                  question: 'Which cell does the node run on?',
                  options: [
                    { label: 'CR2032', description: '225 mAh coin cell' },
                    { label: '2xAA', description: 'about 2500 mAh' },
                  ],
                },
              ],
            }),
            output:
              'User has answered your questions: "Which cell does the node run on?"="2xAA". ' +
              "You can now continue with the user's answers in mind.",
            start: ms() - 590_000,
            end: ms() - 420_000,
          },
          { id: 't1', type: 'text', text: 'Two AA cells, about 2500 mAh. Now the duty cycle.' },
          {
            id: 'call_qa02',
            type: 'tool',
            tool: 'question',
            status: 'running',
            input: JSON.stringify({
              questions: [
                {
                  header: 'Radio',
                  question: 'How often does the node report?',
                  options: [
                    { label: 'Every minute', description: 'about 8 mA for 40 ms each time' },
                    { label: 'Every 10 minutes', description: 'the default in firmware 1.3' },
                  ],
                },
                {
                  header: 'Extras',
                  question: 'What else stays powered?',
                  options: [
                    { label: 'LED', description: 'status LED, 2 mA' },
                    { label: 'Sensor heater', description: 'BME688 gas heater' },
                  ],
                  multiple: true,
                },
              ],
            }),
            start: ms() - 400_000,
          },
        ],
      },
    ],
    sends: [],
    asks: [],
  },
  {
    row: row('ses_lid00000c3', 'Enclosure lid review', { status: 'ended', updated: ms() - 18 * 3600_000 }),
    msgs: [
      {
        id: 'msg_l1',
        role: 'user',
        time: ms() - 20 * 3600_000,
        done: ms() - 20 * 3600_000,
        parts: [{ id: 't0', type: 'text', text: 'Make the lid snap-fit with 1.6 mm PETG walls.' }],
      },
      {
        id: 'msg_l2',
        role: 'assistant',
        model: 'deepseek/deepseek-v4-flash',
        time: ms() - 19.9 * 3600_000,
        done: ms() - 19.8 * 3600_000,
        parts: [{ id: 't0', type: 'text', text: 'Done: four 0.4 mm hooks, 30 degree lead-in.' }],
      },
    ],
    sends: [],
    asks: [],
  },
  ...['Datasheet table parser', 'Gerber export check', 'I2C address scan', 'BOM cost pass'].map((name, i) => ({
    row: row(`ses_more0000d${i}`, name, { status: 'ended', updated: ms() - (2 + i * 3) * 3600_000 }),
    msgs: [],
    sends: [],
    asks: [],
  })),
  {
    row: row('ses_pinold00e1', 'Motor driver thermal', { status: 'ended', updated: ms() - 4 * 86_400_000 }),
    msgs: [],
    sends: [],
    asks: [],
  },
];

const side = { pins: { claude: [], opencode: ['ses_pinold00e1'] }, folds: { claude: null, opencode: null, rooms: null } };

const bySid = (sid) => SESSIONS.find((x) => x.row.session_id === sid);
const tell = (sid, what) => publish('bus', { k: 'wbo', p: { sid, what }, t: Date.now() });
const live = (ev) => publish('wbo', ev);
const RULES = { max: 4, bytes: 5 * 1024 * 1024, types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function formOf(body, ctype) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ctype || '');
  if (!m) return { text: '', pics: [] };
  const sep = Buffer.from(`--${m[1] || m[2]}`);
  const pics = [];
  let text = '';
  let at = body.indexOf(sep);
  while (at >= 0) {
    const next = body.indexOf(sep, at + sep.length);
    if (next < 0) break;
    const part = body.subarray(at + sep.length + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    const head = part.subarray(0, split).toString();
    const data = part.subarray(split + 4);
    if (/name="images"/.test(head)) pics.push(Buffer.from(data));
    else if (/name="text"/.test(head)) text = data.toString();
    at = next;
  }
  return { text, pics };
}

/** OpenCode answers: a message begun, its words a few at a time (with their place), done. */
function answerLive(s, words, after = 600) {
  const sid = s.row.session_id;
  const mid = `msg_live${Math.random().toString(36).slice(2, 10)}`;
  const doc = { id: mid, role: 'assistant', model: 'deepseek/deepseek-v4-flash', time: ms(), done: null, parts: [] };
  setTimeout(() => {
    s.msgs.push(doc);
    s.row.status = 'busy';
    live({ type: 'status', session: sid, status: 'busy' });
    live({ type: 'message', session: sid, id: mid, role: 'assistant', model: doc.model, time: doc.time, done: null });
    const think = 'Reading what changed on the schematic first.';
    doc.parts.push({ id: 'r0', type: 'reasoning', text: think });
    live({ type: 'delta', session: sid, message: mid, part: 'r0', delta: think, o: 0 });
    const part = { id: 't0', type: 'text', text: '' };
    doc.parts.push(part);
    const bits = words.match(/\S+\s*/g) || [];
    bits.forEach((b, i) =>
      setTimeout(
        () => {
          const o = part.text.length;
          part.text += b;
          live({ type: 'delta', session: sid, message: mid, part: 't0', delta: b, o });
          if (i === bits.length - 1) {
            setTimeout(() => {
              doc.done = ms();
              s.row.status = 'idle';
              live({
                type: 'message',
                session: sid,
                id: mid,
                role: 'assistant',
                model: doc.model,
                time: doc.time,
                done: doc.done,
              });
              live({ type: 'status', session: sid, status: 'idle' });
              tell(sid, 'status');
            }, 300);
          }
        },
        400 + i * 180,
      ),
    );
  }, after);
}

/** GET/POST /api/wbo/* and /api/me/side*; false for any other path. */
export function handleWbo(req, res, p, url, body) {
  if (p === '/api/me/side' && req.method === 'GET') return (json(res, 200, side), true);
  if (p === '/api/me/side/pins' && req.method === 'PUT') {
    const b = JSON.parse(body.toString() || '{}');
    const list = side.pins[b.group].filter((x) => x !== b.id);
    side.pins[b.group] = b.pinned ? [b.id, ...list] : list;
    publish('bus', { k: 'side', p: { what: 'prefs' }, t: Date.now() });
    return (json(res, 200, side), true);
  }
  if (p === '/api/me/side/folds' && req.method === 'PUT') {
    const b = JSON.parse(body.toString() || '{}');
    side.folds[b.group] = typeof b.open === 'boolean' ? b.open : null;
    publish('bus', { k: 'side', p: { what: 'prefs' }, t: Date.now() });
    return (json(res, 200, side), true);
  }
  if (!p.startsWith('/api/wbo/')) return false;
  if (p === '/api/wbo/sessions') {
    for (const s of SESSIONS) if (s.row.bridge?.connected) s.row.bridge.seen = secs();
    return (json(res, 200, { sessions: SESSIONS.map((s) => s.row), live_s: 45, images: RULES }), true);
  }
  // Settings > OpenCode's column: one answer for the whole sheet (backend/wb_panel.py)
  const mp = /^\/api\/wbo\/sessions\/([^/]+)\/panel$/.exec(p);
  if (mp) {
    const one = bySid(decodeURIComponent(mp[1]));
    if (!one) return (json(res, 404, { detail: 'no such session' }), true);
    const now = Date.now();
    return (json(res, 200, {
      session: { id: one.row.session_id, title: one.row.title, status: 'busy', asking: false, since: now - 14 * 60_000,
                 model: { providerID: 'commandcode', providerName: 'Command Code', modelID: 'deepseek/deepseek-v4.1-flash',
                          name: 'DeepSeek V4.1 Flash' },
                 context: { used: 730000, limit: 1000000, model: 'deepseek/deepseek-v4.1-flash', pct: 73 },
                 computer: { ...one.row.bridge, name: 'server' } },
      todos: { items: [{ content: 'Read the panel’s file list', status: 'completed' },
                       { content: 'Match a diff’s paths to a call’s', status: 'in_progress' },
                       { content: 'Fold the scratch files away', status: 'pending' }], done: 1, total: 3, at: now },
      files: { items: [
        { path: 'styles.css', count: 1, at: now - 6000_00, status: 'completed', error: false, message: 'm1', additions: 2, deletions: 7 },
        { path: 'docs/SERVER-HEALTH.md', count: 1, at: now - 9000_00, status: 'completed', error: false, message: 'm1', additions: 41, deletions: 0 },
        { path: 'frontend/src/app/rooms/session-panel.ts', count: 2, at: now - 1200_000, status: 'completed', error: false, message: 'm1', additions: 12, deletions: 3 },
      ], more: 0, temp: { items: [
        { path: '.cache/build.json', count: 1, at: now - 1_000_000, status: 'completed', error: false, message: 'm1', temp: true },
        { path: 'node_modules/.cache/x.js', count: 1, at: now - 1_100_000, status: 'completed', error: false, message: 'm1', temp: true },
        { path: '/tmp/claude-oc/probe.ts', count: 1, at: now - 1_200_000, status: 'completed', error: false, message: 'm1', temp: true, outside: true },
      ], more: 0 } },
      tools: { items: [
        { name: 'write', server: '', count: 4, errors: 0, message: 'm1', tool: 'write' },
        { name: 'edit', server: '', count: 2, errors: 0, message: 'm1', tool: 'edit' },
        { name: 'shell', server: '', count: 2, errors: 1, message: 'm1', tool: 'shell' },
        { name: 'glob', server: '', count: 1, errors: 0, message: 'm1', tool: 'glob' },
        { name: 'grep', server: '', count: 1, errors: 0, message: 'm1', tool: 'grep' },
        { name: 'read', server: '', count: 1, errors: 0, message: 'm1', tool: 'read' },
        { name: 'webfetch', server: '', count: 1, errors: 0, message: 'm1', tool: 'webfetch' },
      ], more: 0 },
      tokens: { input: 640000, output: 88000, cache_read: 910000, cache_write: 0, cost: 1.24, source: 'session' },
      pending: [], may_answer: true, why: '', messages: 12, live_s: 45, at: Date.now() / 1000,
    }), true);
  }
  const m = /^\/api\/wbo\/sessions\/([^/]+)(\/.*)?$/.exec(p);
  const s = m && bySid(decodeURIComponent(m[1]));
  if (!s) return (json(res, 404, { detail: 'no such session' }), true);
  const rest = m[2] || '';
  if (!rest) {
    const msgs = s.msgs.slice(-120);
    return (
      json(res, 200, {
        ...s.row,
        messages: msgs,
        truncated: s.msgs.length > 120,
        sends: s.sends,
        asks: s.asks,
        images: RULES,
      }),
      true
    );
  }
  const pic = /^\/messages\/([^/]+)\/images\/(\d+)$/.exec(rest);
  if (pic) {
    const sent = s.sends.find((x) => x.id === pic[1]);
    const data = sent?.bytes?.[Number(pic[2])] ?? (sent ? PICTURE() : null);
    if (!data) return (json(res, 404, { detail: 'no such picture' }), true);
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private' });
    return (res.end(data), true);
  }
  const ans = /^\/asks\/([^/]+)\/answer$/.exec(rest);
  if (ans && req.method === 'POST') {
    if (!s.row.may_send) return (json(res, 403, { detail: "only the session's own person may answer it" }), true);
    const a = s.asks.find((x) => x.id === ans[1]);
    if (!a) return (json(res, 404, { detail: 'no such question' }), true);
    if (a.status !== 'pending') return (json(res, 409, { detail: 'already answered' }), true);
    const b = JSON.parse(body.toString() || '{}');
    a.status = 'answering';
    a.chosen = a.kind === 'permission' ? { decision: b.decision } : { answer: b.answer };
    const sid = s.row.session_id;
    tell(sid, 'message');
    setTimeout(() => {
      a.status = a.kind === 'permission' ? 'replied' : 'answered';
      a.via = 'chat';
      if (a.kind === 'permission') a.decision = b.decision;
      else a.answer = b.answer;
      a.settled_at = secs();
      const open = s.asks.some((x) => x.status === 'pending' || x.status === 'answering');
      s.row.status = open ? 'waiting' : 'busy';
      s.row.asking = open;
      live({ type: 'ask', session: sid, ask: a });
      tell(sid, 'status');
      if (a.kind === 'form')
        answerLive(
          s,
          'Swapped **FB2** for `BLM18PG221SN1` on the schematic and added C31, 47 uF, beside the radio module.',
          300,
        );
    }, 900);
    return (json(res, 202, a), true);
  }
  if (rest === '/messages' && req.method === 'POST') {
    if (!s.row.may_send) return (json(res, 409, { detail: 'no wb-opencode is connected to this session' }), true);
    const ctype = req.headers['content-type'] || '';
    const got = ctype.startsWith('multipart/')
      ? formOf(body, ctype)
      : { text: JSON.parse(body.toString() || '{}').text || '', pics: [] };
    if (got.pics.length > 4) return (json(res, 422, { detail: 'at most 4 pictures with one message' }), true);
    const text = got.text.trim();
    if (!text && !got.pics.length) return (json(res, 422, { detail: 'the message is empty' }), true);
    const id = Math.random().toString(16).slice(2, 18).padEnd(16, '0');
    const sent = {
      id,
      text,
      by: me,
      status: 'queued',
      error: '',
      at: secs(),
      updated: secs(),
      delivered_at: null,
      inbox: null,
      images: got.pics.map((b, n) => ({ n, type: 'image/png', bytes: b.length })),
      images_gone: false,
    };
    Object.defineProperty(sent, 'bytes', { value: got.pics, enumerable: false });
    s.sends.push(sent);
    const sid = s.row.session_id;
    tell(sid, 'message');
    // wb-opencode takes it: an OpenCode message of its own, then OpenCode answers.
    setTimeout(() => {
      const inbox = `msg_in${id.slice(0, 10)}`;
      const at = ms();
      const parts = [];
      if (text) parts.push({ id: 't0', type: 'text', text });
      got.pics.forEach((_, n) => parts.push({ id: `f${n}`, type: 'file', text: `picture-${n + 1}.png` }));
      s.msgs.push({ id: inbox, role: 'user', time: at, done: at, parts });
      sent.status = 'delivered';
      sent.delivered_at = secs();
      sent.inbox = inbox;
      live({ type: 'message', session: sid, id: inbox, role: 'user', time: at, done: at });
      for (const part of parts) live({ type: 'part', session: sid, message: inbox, id: part.id, part });
      tell(sid, 'message');
      answerLive(s, `Looked at it: ${text || 'the pictures'} - the 3V3 rail now holds within 20 mV during the burst.`);
    }, 1400);
    return (json(res, 202, sent), true);
  }
  return (json(res, 404, { detail: 'Not Found' }), true);
}

function PICTURE() {
  return PNG;
}
