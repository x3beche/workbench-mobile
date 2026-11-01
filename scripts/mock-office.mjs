/**
 * The made-up company's Office (backend/office.py): the layout a person's office is drawn from and what
 * each of Ada's agents is doing in it.
 *
 * MOCK_OFFICE=real serves the layout `backend/office.py` itself builds (scripts/fixtures/office-real.json:
 * Lobby, Kitchen, Lounge, Car park, a department per manager, Hot desks - computed from the server's own
 * room_size/next_room_spot/furniture for two managers with a worker each), so a screenshot can show the real
 * building rather than an invented one. The default is the compact 24×14 company: it fits a 390 pt phone at
 * ×1, which is the view the Office opens on.
 *
 * The live rows are the real payload's shape: `activity` from the server's rules, `since` in epoch seconds
 * (a walk is timed from it), a `seat` as an object, and `task.progress` a percent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const now = () => Date.now() / 1000;

function compact() {
  const rooms = [
    { id: 'rm_lobby', floor: 'fl_1', name: 'Lobby', kind: 'lobby', x: 1, y: 1, w: 4, h: 3 },
    { id: 'rm_kitchen', floor: 'fl_1', name: 'Kitchen', kind: 'kitchen', x: 6, y: 1, w: 4, h: 3 },
    { id: 'rm_lounge', floor: 'fl_1', name: 'Lounge', kind: 'lounge', x: 11, y: 1, w: 4, h: 3 },
    { id: 'rm_park', floor: 'fl_1', name: 'Car park', kind: 'parking', x: 16, y: 1, w: 4, h: 3 },
    {
      id: 'rm_workbench', floor: 'fl_1', name: 'WORKBENCH-AGENT', kind: 'department', x: 1, y: 5, w: 7, h: 5,
      department: { manager: 'wbc:rail', desks: 3 },
    },
    {
      id: 'rm_redline', floor: 'fl_1', name: 'PCB design', kind: 'department', x: 9, y: 5, w: 7, h: 5,
      department: { manager: 'wbc:redline', desks: 3 },
    },
    { id: 'rm_hot', floor: 'fl_1', name: 'Hot desks', kind: 'department', x: 17, y: 5, w: 5, h: 5 },
    { id: 'rm_meeting', floor: 'fl_1', name: 'Meeting', kind: 'meeting', x: 17, y: 10, w: 4, h: 3 },
  ];
  const items = [];
  const put = (room, kind, x, y) => items.push({ id: `it_${items.length + 1}`, room, kind, x, y, dir: 0 });
  put('rm_lobby', 'plant', 2, 2);
  put('rm_lobby', 'board', 3, 2);
  put('rm_kitchen', 'coffee', 7, 2);
  put('rm_kitchen', 'plant', 9, 3);
  put('rm_lounge', 'sofa', 12, 2);
  put('rm_lounge', 'plant', 14, 3);
  put('rm_park', 'car_spot', 17, 2);
  for (const x of [2, 4, 6]) {
    for (const kind of ['desk', 'pc']) put('rm_workbench', kind, x, 6);
    put('rm_workbench', 'chair', x, 7);
  }
  for (const x of [10, 12, 14]) {
    for (const kind of ['desk', 'pc']) put('rm_redline', kind, x, 6);
    put('rm_redline', 'chair', x, 7);
  }
  for (const x of [18, 20]) {
    for (const kind of ['desk', 'pc']) put('rm_hot', kind, x, 6);
    put('rm_hot', 'chair', x, 7);
  }
  put('rm_meeting', 'board', 18, 11);
  put('rm_meeting', 'plant', 20, 12);
  const seats = [
    ['wbc:rail', 'rm_workbench', 2, 6],
    ['wbo:rail', 'rm_workbench', 4, 6],
    ['wbo:ota', 'rm_workbench', 6, 6],
    ['wbc:redline', 'rm_redline', 10, 6],
    ['wbo:lid', 'rm_redline', 12, 6],
    ['wbo:off', 'rm_redline', 14, 6],
    ['wbo:hot', 'rm_hot', 18, 6],
  ].map(([agent, room, x, y]) => {
    const desk = items.find((it) => it.room === room && it.kind === 'desk' && it.x === x && it.y === y);
    return { agent, item: desk.id, room, floor: 'fl_1', auto: true };
  });
  return {
    company: { name: 'Office', settings: { director: 'jev', every_s: 180 }, floors: ['fl_1'] },
    tile: 16,
    floors: [{ id: 'fl_1', name: 'Ground floor', order: 0, w: 24, h: 14 }],
    rooms,
    items,
    seats,
    kinds: {
      rooms: ['department', 'kitchen', 'meeting', 'lounge', 'lobby', 'parking'],
      items: ['desk', 'chair', 'pc', 'coffee', 'plant', 'sofa', 'board', 'car_spot'],
    },
  };
}

let real = null;
function realCompany() {
  if (!real) real = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'office-real.json'), 'utf8'));
  return real;
}

export function officeLayout() {
  return process.env.MOCK_OFFICE === 'real' ? realCompany() : compact();
}

/** The agents, by the keys the layout seats: what each is doing, in the live row's shape. */
const ACTIVITY = [
  {
    key: 'wbc:rail', name: 'Sensor board rail sag', kind: 'Claude Code', state: 'working',
    activity: 'typing', bubble: 'Routing the 3.3 V rail', since: 95,
    task: { id: 'a0f239', title: 'Route the 3.3 V rail and run DRC', status: 'working', progress: 62 }, manager: null,
  },
  {
    key: 'wbo:rail', name: 'Rail sag investigation', kind: 'OpenCode', state: 'waiting for the person',
    activity: 'asking', bubble: 'waiting for you', since: 240,
    task: { id: 'b1e4', title: 'Measure TP7 under the radio burst', status: 'waiting', progress: 40 }, manager: 'wbc:rail',
  },
  {
    key: 'wbo:ota', name: 'OTA image and rollback', kind: 'OpenCode', state: 'working',
    activity: 'typing', bubble: 'Reviewing the rollback plan', since: 40,
    task: { id: 'c7a2', title: 'Sign the OTA image and keep the old slot', status: 'working', progress: 18 }, manager: 'wbc:rail',
  },
  {
    key: 'wbc:redline', name: 'PCB design release 1.9.30', kind: 'Claude Code', state: 'working',
    activity: 'thinking', bubble: 'Checking the changelog', since: 12, task: null, manager: null,
  },
  {
    key: 'wbo:lid', name: 'Lid sensor bring-up', kind: 'OpenCode', state: 'working',
    activity: 'break', bubble: 'coffee', since: 12, task: null, manager: 'wbc:redline',
  },
  {
    key: 'wbo:off', name: 'Offline analysis', kind: 'OpenCode', state: 'idle',
    activity: 'lounge', bubble: '', since: 900, task: null, manager: 'wbc:redline',
  },
  {
    key: 'wbo:hot', name: 'Firmware notes', kind: 'OpenCode', state: 'working',
    activity: 'meeting', bubble: 'with WORKBENCH-AGENT', since: 3,
    task: { id: 'd3f0', title: 'Write the boot-sequence notes', status: 'working', progress: 8 }, manager: null,
  },
];

export function officeLive() {
  const layout = officeLayout();
  const t = now();
  const agents = ACTIVITY.map((a) => {
    const seat = layout.seats.find((s) => s.agent === a.key) ?? null;
    return {
      key: a.key,
      name: a.name,
      kind: a.kind,
      state: a.state,
      activity: a.activity,
      bubble: a.bubble,
      seat: seat ? { item: seat.item, room: seat.room, floor: seat.floor } : null,
      ...(a.task ? { task: a.task } : {}),
      since: t - a.since,
      manager: a.manager,
    };
  });
  return { agents, live_s: 10 };
}

/** GET /api/office and GET /api/office/live. */
export function handleOffice(req, res, p) {
  const send = (body) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return true;
  };
  if (req.method === 'GET' && p === '/api/office') return send(officeLayout());
  if (req.method === 'GET' && p === '/api/office/live') return send(officeLive());
  return false;
}
