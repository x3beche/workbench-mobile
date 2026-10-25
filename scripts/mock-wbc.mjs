/**
 * The made-up server's Claude sessions (backend/wbclaude.py's page routes):
 * three of Ada's Claude Code runs - one at its prompt under wb-claude with
 * pictures both ways and enough turns to be read a page at a time, one
 * working under an old wb-claude (no pictures, "update wb-claude"), one
 * ended without wb-claude (the composer is a note). A line sent is queued,
 * then waits while "Claude works", is delivered and shows as a remote prompt
 * with an answer, each step told on the bus (`wbc`).
 */
import { deflateSync } from 'node:zlib';

import { publish } from './mock-s2.mjs';

const MARK = '[remote message from Workbench]';
const now = () => Date.now() / 1000;
const me = { id: 'u1', name: 'Ada Demir' };

// ---- a few pictures, drawn here as PNGs ----------------------------------------

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(kind, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(kind), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A w x h PNG painted by `px(x, y)` -> [r, g, b]. */
function png(w, h, px) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
// A scope trace: a dark screen, a grid and a sagging rail.
const SCOPE = png(480, 320, (x, y) => {
  const grid = x % 60 === 0 || y % 40 === 0;
  const rail = Math.round(120 + (x > 200 && x < 260 ? 34 * Math.sin(((x - 200) / 60) * Math.PI) : 0));
  if (Math.abs(y - rail) < 2) return [250, 204, 21];
  return grid ? [48, 52, 60] : [18, 20, 24];
});
// A board: green with pads.
const BOARD = png(400, 300, (x, y) => {
  const pad = (x % 50 > 20 && x % 50 < 34 && y % 60 > 22 && y % 60 < 38) || (x > 160 && x < 240 && y > 110 && y < 190);
  return pad ? [212, 175, 55] : [22, 92, 54];
});
// A terminal screenshot a tool read.
const TERM = png(360, 220, (x, y) => {
  const line = y > 16 && (y - 16) % 22 < 10 && x > 14 && x < 14 + ((y * 37) % 260) + 60;
  return line ? [180, 186, 196] : [24, 26, 30];
});
const PICS = { scope: SCOPE, board: BOARD, term: TERM };

// ---- the sessions ------------------------------------------------------------------

function bridge(over) {
  return {
    id: 'b1',
    connected: true,
    state: 'idle',
    detail: '',
    remote: true,
    host: 'ada-laptop',
    platform: 'linux',
    version: '0.2.1',
    cwd: '~/projects/sensor-board',
    queue: 0,
    seen: now(),
    started: now() - 3600,
    images: true,
    outdated: false,
    ...over,
  };
}

/** The first session's conversation: 24 earlier exchanges, then the pictures. */
function railTurns() {
  const t0 = now() - 3 * 3600;
  const out = [];
  for (let i = 0; i < 12; i++) {
    const at = t0 + i * 300;
    out.push({
      id: `r${i}`,
      role: 'user',
      text: `Step ${i + 1}: check the ${['LDO', 'bead', 'caps', 'trace'][i % 4]} again`,
      at,
      remote: false,
    });
    out.push({
      id: `r${i}`,
      role: 'assistant',
      text: `Done with step ${i + 1}. The ${['LDO', 'bead', 'caps', 'trace'][i % 4]} looks **fine**; next is step ${i + 2}.`,
      at: at + 40,
      model: 'claude-sonnet-4-5',
    });
  }
  const at = now() - 25 * 60;
  out.push({
    id: 'rp1',
    role: 'user',
    text: 'Here is the scope trace and the board. Why does the rail sag under the radio burst?',
    at,
    remote: false,
    images: [
      { req: 'rp1', n: 0, type: 'image/png' },
      { req: 'rp1', n: 1, type: 'image/png' },
    ],
  });
  out.push({
    id: 'rp2',
    role: 'assistant',
    text:
      'The dip lines up with **FB2**: its DC resistance drops about 95 mV at 380 mA.\n\n' +
      '1. Swap FB2 for `BLM18PG221SN1` (0.05 ohm)\n2. Add 47 uF next to the module\n\n```sh\nkicad-cli pcb drc board.kicad_pcb\n```',
    at: at + 90,
    model: 'claude-sonnet-4-5',
    images: [
      { req: 'rp2', n: 0, type: 'image/png' },
      { req: 'rpgone', n: 0, type: 'image/png' },
    ],
  });
  out.push({
    id: 'rp3',
    role: 'user',
    text: `${MARK} Run the DRC and tell me what it finds`,
    at: at + 400,
    remote: true,
  });
  out.push({
    id: 'rp3',
    role: 'assistant',
    text: 'DRC found **2** clearance errors near `U4`; both are 0.12 mm where 0.15 mm is asked. I widened the gap.',
    at: at + 460,
    model: 'claude-sonnet-4-5',
  });
  return out;
}

const SESSIONS = [
  {
    row: {
      session_id: 'a1b2c3d4-rail',
      name: 'Sensor board rail sag',
      title: '',
      status: 'active',
      computer: 'ada-laptop',
      first_ts: now() - 3 * 3600,
      last_ts: now() - 60,
      prompts: 15,
      requests: 120,
      known: true,
      mine: true,
      owner: me,
      bridge: bridge({}),
      may_send: true,
      why: '',
    },
    turns: railTurns(),
    messages: [],
  },
  {
    row: {
      session_id: 'e5f6a7b8-ota',
      name: 'OTA rollback watchdog',
      title: '',
      status: 'active',
      computer: 'workstation',
      first_ts: now() - 5400,
      last_ts: now() - 20,
      prompts: 4,
      requests: 31,
      known: true,
      mine: true,
      owner: me,
      bridge: bridge({
        id: 'b2',
        state: 'working',
        host: 'workstation',
        version: '0.1.4',
        images: false,
        outdated: true,
        cwd: '~/fw/ota',
      }),
      may_send: true,
      why: '',
    },
    turns: [
      {
        id: 'o1',
        role: 'user',
        text: 'Add a watchdog to the OTA updater so a failed image rolls back.',
        at: now() - 5000,
      },
      {
        id: 'o1',
        role: 'assistant',
        text: 'I added `ota_guard()` and a boot counter in RTC memory; three failed boots roll back.',
        at: now() - 4800,
        model: 'claude-opus-4-1',
      },
    ],
    messages: [],
  },
  {
    row: {
      session_id: '9c0d1e2f-review',
      name: 'Enclosure lid review',
      title: '',
      status: 'ended',
      computer: 'ada-laptop',
      first_ts: now() - 20 * 3600,
      last_ts: now() - 18 * 3600,
      prompts: 2,
      requests: 9,
      known: true,
      mine: true,
      owner: me,
      bridge: null,
      may_send: false,
      why: 'no-bridge',
    },
    turns: [
      { id: 'v1', role: 'user', text: 'Make the lid snap-fit with 1.6 mm PETG walls.', at: now() - 20 * 3600 },
      {
        id: 'v1',
        role: 'assistant',
        text: 'Done: four 0.4 mm hooks, 30° lead-in.',
        at: now() - 19.9 * 3600,
        model: 'claude-sonnet-4-5',
      },
    ],
    messages: [],
  },
];

const bySid = (sid) => SESSIONS.find((x) => x.row.session_id === sid);
const tell = (sid, what) => publish('bus', { k: 'wbc', p: { sid, what }, t: Date.now() });
const RULES = { max: 4, bytes: 5 * 1024 * 1024, types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Pictures in a multipart body: their bytes, by the parts named "images". */
function formImages(body, ctype) {
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

/** GET/POST /api/wbc/*; false for any other path. */
export function handleWbc(req, res, p, url, body) {
  if (!p.startsWith('/api/wbc/')) return false;
  if (p === '/api/wbc/sessions') {
    for (const s of SESSIONS) if (s.row.bridge?.connected) s.row.bridge.seen = now();
    return (
      json(res, 200, { sessions: SESSIONS.map((s) => s.row), configured: true, live_s: 45, mark: MARK, images: RULES }),
      true
    );
  }
  const m = /^\/api\/wbc\/sessions\/([^/]+)(\/.*)?$/.exec(p);
  const s = m && bySid(decodeURIComponent(m[1]));
  if (!s) return (json(res, 404, { detail: 'no such session' }), true);
  const rest = m[2] || '';
  if (!rest) return (json(res, 200, { ...s.row, messages: s.messages, mark: MARK, images: RULES }), true);
  if (rest === '/turns') {
    const limit = Number(url.searchParams.get('limit') || 40);
    const before = Number(url.searchParams.get('before') || 0);
    const rows = before ? s.turns.filter((x) => x.at < before) : s.turns;
    let cut = Math.max(0, rows.length - limit);
    while (cut < rows.length && rows[cut].role !== 'user') cut++;
    const got = rows.slice(cut);
    // Slow enough for the loader at the top to be seen.
    return (
      setTimeout(() => json(res, 200, { turns: got, more: cut > 0, before: got[0]?.at ?? null }), before ? 700 : 0),
      true
    );
  }
  const pic = /^\/images\/([^/]+)\/(\d+)$/.exec(rest);
  if (pic) {
    const which = pic[1] === 'rp1' ? (pic[2] === '0' ? 'scope' : 'board') : pic[1] === 'rp2' ? 'term' : null;
    // A line sent from here, as the gateway recorded its prompt: the same pictures.
    const own = pic[1].startsWith('w')
      ? s.messages.find((x) => x.id === pic[1].slice(1))?.bytes?.[Number(pic[2])]
      : null;
    if (!which && !own) return (json(res, 404, { detail: 'that picture is no longer kept' }), true);
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private' });
    return (res.end(own || PICS[which]), true);
  }
  const sent = /^\/messages\/([^/]+)\/images\/(\d+)$/.exec(rest);
  if (sent) {
    const msg = s.messages.find((x) => x.id === sent[1]);
    const data = msg?.bytes?.[Number(sent[2])];
    if (!data) return (json(res, 404, { detail: 'no such picture' }), true);
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private' });
    return (res.end(data), true);
  }
  if (rest === '/messages' && req.method === 'POST') {
    if (!s.row.may_send) return (json(res, 409, { detail: 'no wb-claude is connected to this session' }), true);
    const ctype = req.headers['content-type'] || '';
    const got = ctype.startsWith('multipart/')
      ? formImages(body, ctype)
      : { text: JSON.parse(body.toString() || '{}').text || '', pics: [] };
    if (got.pics.length && !s.row.bridge?.images) {
      return (
        json(res, 409, {
          detail: 'the wb-claude on that computer is too old to take pictures - run its installer again',
        }),
        true
      );
    }
    if (got.pics.length > 4) return (json(res, 422, { detail: 'at most 4 pictures with one message' }), true);
    const text = got.text.trim();
    if (!text && !got.pics.length) return (json(res, 422, { detail: 'the message is empty' }), true);
    const id = Math.random().toString(16).slice(2, 18).padEnd(16, '0');
    const msg = {
      id,
      text,
      by: me,
      status: 'queued',
      detail: '',
      error: '',
      at: now(),
      updated: now(),
      delivered_at: null,
      images: got.pics.map((b, n) => ({ n, type: 'image/png', bytes: b.length })),
      images_gone: false,
    };
    Object.defineProperty(msg, 'bytes', { value: got.pics, enumerable: false });
    s.messages.push(msg);
    tell(s.row.session_id, 'message');
    // Claude is working: it waits; at the prompt again, it is typed in and Claude answers.
    setTimeout(() => {
      msg.status = 'waiting';
      msg.updated = now();
      s.row.bridge = { ...s.row.bridge, state: 'working' };
      tell(s.row.session_id, 'message');
    }, 900);
    setTimeout(() => {
      msg.status = 'delivered';
      msg.delivered_at = now();
      tell(s.row.session_id, 'message');
    }, 2600);
    setTimeout(() => {
      const at = now();
      s.turns.push({
        id: `w${id}`,
        role: 'user',
        text: `${MARK} ${text}`,
        at,
        remote: true,
        ...(got.pics.length ? { images: got.pics.map((_, n) => ({ req: `w${id}`, n, type: 'image/png' })) } : {}),
      });
      s.turns.push({
        id: `w${id}`,
        role: 'assistant',
        text: `On it: ${text || 'the pictures'}.`,
        at: at + 1,
        model: 'claude-sonnet-4-5',
      });
      s.row.bridge = { ...s.row.bridge, state: 'idle' };
      s.row.last_ts = at;
      tell(s.row.session_id, 'bridge');
    }, 3600);
    return (json(res, 202, msg), true);
  }
  return (json(res, 404, { detail: 'Not Found' }), true);
}
