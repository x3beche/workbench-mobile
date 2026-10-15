/**
 * Files for the made-up server (scripts/mock-api.mjs): My files with
 * folders, In the app (the read-only tree), Deleted files, and the small
 * pictures, PDF pages and file bodies the app reads - answering as
 * backend/files_api.py does. Pictures are drawn here as SVG (no image
 * library needed); the screenshots are taken in a browser, which shows them.
 */
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const me = { id: 'u1', name: 'Ada Demir' };
const kerem = { id: 'u2', name: 'Kerem' };

const KIND = {
  png: ['image', 'image'],
  jpg: ['image', 'image'],
  pdf: ['pdf', 'pdf'],
  md: ['text', 'markdown'],
  csv: ['bom', 'table'],
  step: ['step', 'step'],
  c: ['text', 'text'],
  py: ['text', 'text'],
  zip: ['archive', 'archive'],
  mp4: ['video', 'video'],
  kicad_pcb: ['text', 'text'],
};
let next = 100;
function f(id, name, folder, bytes, min, extra = {}) {
  const ext = name.split('.').pop().toLowerCase();
  const [kind, preview] = KIND[ext] ?? ['other', 'none'];
  return {
    id,
    name,
    folder,
    bytes,
    kind,
    preview,
    content_type: '',
    created_at: ago(min),
    by: me,
    note: '',
    context: {},
    sha256: `${id}sha`,
    ...extra,
  };
}
const dir = (id, name, parent = '') => ({ id, name, parent, path: name, by: me, created_at: ago(9000) });

const folders = [
  dir('d1', 'Datasheets'),
  dir('d2', 'Photos'),
  dir('d3', 'Firmware'),
  dir('d4', 'Rev C', 'd1'),
  { ...dir('dchat', 'Chat'), ro: true, where: 'chat' },
];

const PHOTOS = [
  'board-top',
  'board-bottom',
  'rework-FB2',
  'usb-c-port',
  'antenna-keepout',
  'enclosure-fit',
  'lid-snap',
  'tp7-probe',
  'scope-setup',
  'reflow-profile',
  'stencil',
  'paste-check',
  'u4-closeup',
  'radio-module',
  'battery-holder',
  'button-row',
  'led-test',
  'panel-front',
  'panel-back',
  'cable-strain',
  'label-print',
  'box-open',
  'box-closed',
  'bench',
];

const files = [
  f('f1', 'scope-tx-burst.png', '', 412_000, 50),
  f('f2', 'bring-up-notes.md', '', 6_400, 300),
  f('f3', 'enclosure-v3.step', '', 2_840_000, 60 * 26),
  f('f4', 'BOM rev C.csv', '', 9_100, 60 * 50),
  f('f5', 'AP2112K-3.3 datasheet.pdf', 'd1', 820_000, 60 * 24 * 6),
  f('f6', 'BLM18PG221SN1.pdf', 'd1', 310_000, 60 * 24 * 6),
  f('f7', 'ESP32-C3 hardware design.pdf', 'd1', 2_100_000, 60 * 24 * 12),
  f('f8', 'ota.c', 'd3', 14_200, 60 * 30),
  f('f9', 'flash.py', 'd3', 2_300, 60 * 30),
  f('f10', 'radio-burst.mp4', '', 18_400_000, 60 * 70, { by: kerem }),
  ...PHOTOS.map((p, i) => f(`p${i}`, `${p}.jpg`, 'd2', 1_200_000 + i * 37_000, 60 * 24 + i * 40)),
  // The Chat's own upload: In the app, never My files.
  f('c9', 'rail-photo.jpg', 'dchat', 980_000, 30, { where: 'chat', ro: true }),
];

const roots = [
  ['v:projects', 'Projects', 'projects'],
  ['v:chat', 'Chat', 'chat'],
  ['v:parts', 'Parts', 'parts'],
  ['v:agents', 'Agents', 'agents'],
  ['v:taste', 'Taste', 'taste'],
].map(([id, name, where]) => ({ id, name, parent: '', ro: true, root: true, where, by: {}, created_at: '' }));
const vdir = (id, name, parent, where) => ({ id, name, parent, ro: true, where, by: {}, created_at: ago(500) });
const vfile = (id, name, folder, bytes, where) => ({ ...f(id, name, folder, bytes, 400), ro: true, where, by: {} });
const tree = {
  folders: [
    ...roots,
    vdir('v:pf:sensor', 'Sensor board', 'v:projects', 'cad'),
    vdir('v:pf:enc', 'Enclosure', 'v:projects', 'cad'),
    vdir('v:cc:c1', '3.3 V rail sag', 'v:chat', 'chat'),
    vdir('v:qm:murata', 'Murata', 'v:parts', 'parts'),
  ],
  files: [
    vfile('v:ms:board', 'sensor-board.step', 'v:pf:sensor', 4_200_000, 'cad'),
    vfile('v:ba:layers', 'sensor-board-layers.pdf', 'v:pf:sensor', 1_400_000, 'pcb'),
    vfile('v:ba:bom', 'sensor-board-bom.csv', 'v:pf:sensor', 7_800, 'pcb'),
    vfile('v:ms:lid', 'lid.step', 'v:pf:enc', 1_100_000, 'cad'),
  ],
  links: [{ folder: 'v:cc:c1', file: 'c9' }],
};

const trash = [
  { ...f('t1', 'old-pinout.pdf', 'd1', 220_000, 60 * 24 * 9), days_left: 21, folder_path: 'Datasheets' },
  { ...f('t2', 'enclosure-v2.step', '', 2_600_000, 60 * 24 * 20), days_left: 26, folder_path: '' },
  { ...f('t3', 'IMG_2231.jpg', 'd2', 1_900_000, 60 * 24 * 2), days_left: 29, folder_path: 'Photos' },
].map((t) => ({
  ...t,
  deleted_at: ago(60 * 24 * (30 - t.days_left)),
  deleted_by: me,
  purge_at: ago(-60 * 24 * t.days_left),
}));

// ---- pictures ----------------------------------------------------------

const hue = (s) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);

function scope(w, h) {
  const grid = [];
  for (let i = 1; i < 10; i++) grid.push(`<path d="M${(w * i) / 10} 0V${h}" />`);
  for (let i = 1; i < 8; i++) grid.push(`<path d="M0 ${(h * i) / 8}H${w}" />`);
  let d = `M0 ${h * 0.3}`;
  for (let x = 0; x <= w; x += w / 120) {
    const dip = x > w * 0.42 && x < w * 0.62 ? h * 0.22 * Math.exp(-((x - w * 0.47) ** 2) / (w * w * 0.002)) : 0;
    d += ` L${x.toFixed(1)} ${(h * 0.3 + dip + Math.sin(x / 3) * h * 0.004).toFixed(1)}`;
  }
  let c = `M0 ${h * 0.75}`;
  for (let x = 0; x <= w; x += w / 60)
    c += ` L${x.toFixed(1)} ${(x > w * 0.42 && x < w * 0.62 ? h * 0.6 : h * 0.78).toFixed(1)}`;
  return `<rect width="${w}" height="${h}" fill="#0b0f0c"/><g stroke="#1f2a22" stroke-width="${w / 400}">${grid.join('')}</g>
<path d="${d}" fill="none" stroke="#f5d742" stroke-width="${w / 220}"/><path d="${c}" fill="none" stroke="#3fc6e8" stroke-width="${w / 260}"/>
<text x="${w * 0.02}" y="${h * 0.07}" fill="#f5d742" font-family="DejaVu Sans Mono, monospace" font-size="${h * 0.045}">CH1 500mV/div  3.05V min</text>
<text x="${w * 0.02}" y="${h * 0.96}" fill="#3fc6e8" font-family="DejaVu Sans Mono, monospace" font-size="${h * 0.045}">CH2 TX_EN  200us/div</text>`;
}

function photo(name, w, h) {
  const g = hue(name);
  const parts = [];
  let seed = g;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w * 0.85,
      y = rnd() * h * 0.85,
      s = (0.05 + rnd() * 0.14) * w;
    parts.push(
      `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${s.toFixed(0)}" height="${(s * (0.4 + rnd())).toFixed(0)}" rx="${w / 160}" fill="${i % 3 ? '#1b1b1f' : '#c9a24a'}" opacity=".9"/>`,
    );
  }
  for (let i = 0; i < 18; i++) {
    const y = rnd() * h;
    parts.push(
      `<path d="M0 ${y.toFixed(0)} C${w / 3} ${(y + rnd() * 60 - 30).toFixed(0)} ${(2 * w) / 3} ${(y + rnd() * 80 - 40).toFixed(0)} ${w} ${(y + rnd() * 40).toFixed(0)}" stroke="#d6b35a" stroke-opacity=".35" stroke-width="${w / 260}" fill="none"/>`,
    );
  }
  return `<defs><radialGradient id="l" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="hsl(${(g % 40) + 130} 45% 32%)"/><stop offset="1" stop-color="hsl(${(g % 40) + 130} 50% 12%)"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#l)"/>${parts.join('')}`;
}

function model(w, h) {
  const c = w / 2,
    m = h / 2,
    s = w * 0.28;
  return `<rect width="${w}" height="${h}" fill="#e9e9ec"/>
<path d="M${c} ${m - s} L${c + s * 1.1} ${m - s * 0.45} L${c} ${m + s * 0.1} L${c - s * 1.1} ${m - s * 0.45}Z" fill="#c5c8ce"/>
<path d="M${c - s * 1.1} ${m - s * 0.45} L${c} ${m + s * 0.1} L${c} ${m + s * 1.05} L${c - s * 1.1} ${m + s * 0.5}Z" fill="#9aa0a8"/>
<path d="M${c + s * 1.1} ${m - s * 0.45} L${c} ${m + s * 0.1} L${c} ${m + s * 1.05} L${c + s * 1.1} ${m + s * 0.5}Z" fill="#7d838c"/>
<ellipse cx="${c}" cy="${m - s * 0.45}" rx="${s * 0.32}" ry="${s * 0.16}" fill="#8a9099"/>`;
}

function page(name, n, w, h) {
  const t = (x, y, size, text, weight = 400, fill = '#18181b') =>
    `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${text}</text>`;
  const out = [`<rect width="${w}" height="${h}" fill="#ffffff"/>`];
  const title = name.replace(/\.pdf$/i, '');
  out.push(t(w * 0.08, h * 0.07, w * 0.04, n === 1 ? title : `${title} - ${n}`, 700));
  out.push(`<rect x="${w * 0.08}" y="${h * 0.085}" width="${w * 0.84}" height="${h * 0.003}" fill="#d4d4d8"/>`);
  let y = h * 0.12;
  const lines = n === 1 ? 8 : 5;
  for (let i = 0; i < lines; i++, y += h * 0.022)
    out.push(
      `<rect x="${w * 0.08}" y="${y}" width="${w * (0.84 - ((i * 37) % 9) * 0.03)}" height="${h * 0.008}" fill="#a1a1aa"/>`,
    );
  y += h * 0.02;
  out.push(t(w * 0.08, y + h * 0.02, w * 0.026, n === 1 ? 'Features' : 'Electrical characteristics', 700));
  y += h * 0.04;
  const rows = [
    ['Parameter', 'Min', 'Typ', 'Max'],
    ['Output voltage', '3.23', '3.30', '3.37'],
    ['Dropout at 600 mA', '', '250', '400'],
    ['Quiescent current', '', '55', '80'],
    ['PSRR at 1 kHz', '', '65', ''],
  ];
  for (const [i, r] of rows.entries()) {
    out.push(
      `<rect x="${w * 0.08}" y="${y}" width="${w * 0.84}" height="${h * 0.032}" fill="${i ? (i % 2 ? '#f4f4f5' : '#ffffff') : '#e4e4e7'}"/>`,
    );
    r.forEach((cell, j) =>
      out.push(t(w * (0.1 + j * 0.2 + (j ? 0.16 : 0)), y + h * 0.022, w * 0.022, cell, i ? 400 : 700)),
    );
    y += h * 0.032;
  }
  y += h * 0.04;
  // A figure: a curve on axes.
  const fx = w * 0.12,
    fy = y,
    fw = w * 0.76,
    fh = h * 0.22;
  out.push(
    `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none" stroke="#71717a" stroke-width="${w * 0.002}"/>`,
  );
  let d = `M${fx} ${fy + fh * 0.2}`;
  for (let k = 0; k <= 40; k++) d += ` L${fx + (fw * k) / 40} ${fy + fh * (0.2 + 0.6 * (1 - Math.exp(-k / (8 + n))))}`;
  out.push(`<path d="${d}" fill="none" stroke="#18181b" stroke-width="${w * 0.004}"/>`);
  y = fy + fh + h * 0.04;
  for (let i = 0; i < 6 && y < h * 0.95; i++, y += h * 0.022)
    out.push(
      `<rect x="${w * 0.08}" y="${y}" width="${w * (0.84 - ((i * 53) % 7) * 0.04)}" height="${h * 0.008}" fill="#a1a1aa"/>`,
    );
  out.push(t(w * 0.46, h * 0.975, w * 0.02, String(n), 400, '#71717a'));
  return out.join('\n');
}

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

function picture(file, w, h) {
  if (file.name.startsWith('scope')) return svg(w, h, scope(w, h));
  if (file.preview === 'pdf') return svg(w, h * 1.294, page(file.name, 1, w, h * 1.294));
  if (file.preview === 'step') return svg(w, h, model(w, h));
  return svg(w, h, photo(file.name, w, h));
}

const TEXT = {
  f2: `# Sensor board bring-up

## Rails
- 3.3 V: 3.29 V idle, **3.05 V** during the radio burst
- 1.8 V: 1.80 V, flat

## Next
1. Scope TP7 with the radio sending
2. Swap FB2 for the 1 A part
3. Add 47 uF next to the module

| Rail | Idle | Burst |
|------|------|-------|
| 3V3  | 3.29 | 3.05  |
`,
  f8: `/* OTA update with rollback (sensor board, ESP32-C3) */
#include "esp_ota_ops.h"
#include "esp_task_wdt.h"

static const int CONFIRM_AFTER_S = 30;

void ota_confirm_or_rollback(void) {
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_img_states_t state;
    if (esp_ota_get_state_partition(running, &state) != ESP_OK) return;
    if (state == ESP_OTA_IMG_PENDING_VERIFY) {
        if (self_test_passed()) esp_ota_mark_app_valid_cancel_rollback();
        else esp_ota_mark_app_invalid_rollback_and_reboot();
    }
}
`,
  f9: `import serial, sys\n\nPORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttyUSB0"\nprint("flashing over", PORT)\n`,
};

const TABLE = {
  sheets: ['BOM rev C'],
  sheet: 0,
  total: 6,
  truncated: false,
  rows: [
    ['Ref', 'Value', 'Part', 'Qty'],
    ['U4', '3.3 V LDO', 'AP2112K-3.3', '1'],
    ['FB2', '220R @ 100 MHz', 'BLM18PG221SN1', '1'],
    ['C12', '47 uF', 'GRM21BR61A476ME15', '1'],
    ['J1', 'USB-C', 'TYPE-C-31-M-12', '1'],
    ['U1', 'MCU', 'ESP32-C3-MINI-1', '1'],
  ],
};

// ---- routes ------------------------------------------------------------

const send = (res, status, body, type = 'application/json', headers = {}) => {
  res.writeHead(status, { 'Content-Type': type, ...headers });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const out = (x) => ({ ...x });
const trashOut = (t) => ({ ...t });
const asked = new Map();

export function handleFiles(req, res, p, url, body) {
  const json = () => JSON.parse(body.toString() || '{}');
  const m = req.method;
  if (p === '/api/files' && m === 'GET') return (send(res, 200, files.map(out)), true);
  if (p === '/api/files' && m === 'POST') {
    const names = [...body.toString('latin1').matchAll(/filename="([^"]+)"/g)].map((x) => x[1]);
    const folder = (body.toString('latin1').match(/name="folder"\r\n\r\n([^\r]*)/) || [])[1] || '';
    const made = names.map((n) => f(`u${next++}`, n, folder, 120_000, 0));
    files.push(...made);
    return (send(res, 200, made), true);
  }
  if (p === '/api/files/folders' && m === 'GET') return (send(res, 200, folders), true);
  if (p === '/api/files/folders' && m === 'POST') {
    const b = json();
    const d = dir(`d${next++}`, b.name, b.parent || '');
    folders.push(d);
    return (send(res, 200, d), true);
  }
  if (p === '/api/files/virtual') return (send(res, 200, tree), true);
  if (p === '/api/files/trash') return (send(res, 200, { days: 30, files: trash.map(trashOut) }), true);
  if (p === '/api/files/trash/restore') {
    const ids = json().files || [];
    const back = trash.filter((t) => ids.includes(t.id));
    for (const t of back) {
      trash.splice(trash.indexOf(t), 1);
      files.push(t);
    }
    return (send(res, 200, { restored: back, refused: [] }), true);
  }
  if (p === '/api/files/trash/purge') {
    const ids = json().files || [];
    for (const id of ids) {
      const i = trash.findIndex((t) => t.id === id);
      if (i >= 0) trash.splice(i, 1);
    }
    return (send(res, 200, { purged: ids }), true);
  }
  if (p === '/api/files/move') {
    const b = json();
    for (const id of b.files || []) {
      const x = files.find((y) => y.id === id);
      if (x) x.folder = b.to;
    }
    for (const id of b.folders || []) {
      const x = folders.find((y) => y.id === id);
      if (x) x.parent = b.to;
    }
    return (send(res, 200, { files: (b.files || []).length, folders: (b.folders || []).length }), true);
  }
  const fm = p.match(/^\/api\/files\/folders\/([^/]+)$/);
  if (fm) {
    const d = folders.find((x) => x.id === fm[1]);
    if (!d) return (send(res, 404, { detail: fm[1] }), true);
    if (m === 'PATCH') Object.assign(d, { name: json().name });
    if (m === 'DELETE') folders.splice(folders.indexOf(d), 1);
    return (send(res, 200, d), true);
  }
  const one = p.match(/^\/api\/files\/([^/]+)(\/.*)?$/);
  if (!one) return false;
  const id = decodeURIComponent(one[1]);
  const rest = one[2] || '';
  const file = files.find((x) => x.id === id) || tree.files.find((x) => x.id === id) || trash.find((x) => x.id === id);
  if (!file) return (send(res, 404, { detail: id }), true);
  if (rest === '/mini') {
    // The STEP's picture takes a moment the first time, as a real render does.
    const n = (asked.get(id) || 0) + 1;
    asked.set(id, n);
    if (file.preview === 'step' && n === 1)
      return (send(res, 202, { state: 'making' }, 'application/json', { 'Retry-After': '2' }), true);
    if (!['image', 'pdf', 'step'].includes(file.preview))
      return (send(res, 404, { detail: 'no picture for this file' }), true);
    return (send(res, 200, picture(file, 160, 160), 'image/svg+xml'), true);
  }
  if (rest === '/pdf') return (send(res, 200, { id, name: file.name, count: 4, pages: [{ n: 1, text: '' }] }), true);
  const pg = rest.match(/^\/pdf\/page\/(\d+)\.png$/);
  if (pg) return (send(res, 200, svg(850, 1100, page(file.name, Number(pg[1]), 850, 1100)), 'image/svg+xml'), true);
  if (rest === '/table') return (send(res, 200, TABLE), true);
  if (rest === '/copy') {
    const made = {
      ...file,
      id: `u${next++}`,
      name: file.name.replace(/(\.[^.]+)$/, ' (copy)$1'),
      folder: json().folder || '',
      ro: undefined,
      where: undefined,
      by: me,
    };
    files.push(made);
    return (send(res, 200, made), true);
  }
  if (!rest && m === 'PATCH') {
    Object.assign(file, { name: json().name ?? file.name });
    return (send(res, 200, file), true);
  }
  if (!rest && m === 'DELETE') {
    files.splice(files.indexOf(file), 1);
    trash.unshift({
      ...file,
      deleted_at: ago(0),
      deleted_by: me,
      purge_at: ago(-60 * 24 * 30),
      days_left: 30,
      folder_path: folders.find((d) => d.id === file.folder)?.name || '',
    });
    return (send(res, 200, { deleted: id }), true);
  }
  if (!rest) {
    if (TEXT[id]) return (send(res, 200, TEXT[id], 'text/plain; charset=utf-8'), true);
    if (file.preview === 'image') return (send(res, 200, picture(file, 1200, 900), 'image/svg+xml'), true);
    return (send(res, 200, `made-up bytes of ${file.name}\n`, 'application/octet-stream'), true);
  }
  return (send(res, 404, { detail: 'Not Found' }), true);
}
