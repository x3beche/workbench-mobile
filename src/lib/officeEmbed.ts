/**
 * The Office's embed page, as the phone hosts it: the protocol between the app and the page, and the stand-in page
 * the app draws until the real one lands.
 *
 * The picture is the **web's own** - `/office/embed`, served by the Workbench server, drawn by the web's
 * isometric engine (docs/OFFICE.md, #a02107). The phone hosts it in a WebView and speaks to it; nothing of the
 * drawing lives in the app any more
 *
 *   page -> app    {"type":"ready"}                          the picture is drawn
 *                  {"type":"state","floor":..,"agents":..}   what to put in the bar (optional)
 *                  {"type":"open","agent":"wbo:ses_.."}      a character was tapped: open its session
 *                  {"type":"error","message":".."}           the page could not draw
 *
 *   app -> page    {"type":"hello","theme":"dark|light","themeId":..,"lang":"en|tr",
 *                   "insets":{top,bottom,left,right},"server":".."}   once loaded, and when any of it changes
 *                  {"type":"pause"} / {"type":"resume"}      the app went behind another one, and came back
 *
 * A message is JSON in a `postMessage` (the WebView's own channel on the phone, `window.postMessage` on the web
 * build), and anything the page sends that this module does not know is ignored - a newer page may say more.
 */

export type PageMessage =
  | { type: 'ready' }
  | { type: 'state'; floor?: string; agents?: number }
  | { type: 'open'; agent: string }
  | { type: 'error'; message: string };

/** What the app tells the page, as one JSON string (the mock and the real page read the same). */
export interface Hello {
  theme: 'dark' | 'light';
  themeId: string;
  lang: 'en' | 'tr';
  insets: { top: number; bottom: number; left: number; right: number };
  /** The server the page is on, so it knows where its own /api is (it is served by that server). */
  server: string;
}

export function helloOf(h: Hello): string {
  return JSON.stringify({ type: 'hello', ...h });
}

/** A page's message, read; null for anything that is not one of the four - never a throw from a stray string. */
export function pageMessageOf(raw: unknown): PageMessage | null {
  if (typeof raw !== 'string' || !raw) return null;
  let got: unknown;
  try {
    got = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!got || typeof got !== 'object') return null;
  const m = got as Record<string, unknown>;
  switch (m.type) {
    case 'ready':
      return { type: 'ready' };
    case 'state': {
      const floor = typeof m.floor === 'string' && m.floor.trim() ? m.floor.trim() : undefined;
      const agents = typeof m.agents === 'number' && Number.isFinite(m.agents) ? Math.max(0, Math.trunc(m.agents)) : undefined;
      return { type: 'state', ...(floor ? { floor } : {}), ...(agents !== undefined ? { agents } : {}) };
    }
    case 'open': {
      const agent = typeof m.agent === 'string' ? m.agent.trim() : '';
      return agent ? { type: 'open', agent } : null;
    }
    case 'error': {
      const message = typeof m.message === 'string' && m.message.trim() ? m.message.trim() : 'The office could not be drawn.';
      return { type: 'error', message };
    }
    default:
      return null;
  }
}

/** The name the page calls to hear from the app (and the one the WebView injects it through). */
export const PAGE_HOOK = '__workbenchOffice';

/**
 * The stand-in page, drawn here until the web's own `/office/embed` lands.
 *
 * It speaks the whole protocol - ready, state, open on a tap, the theme and the language, pause and resume - so
 * the app's side of the bridge is the real one, and switching to the real page changes nothing in the app. The
 * picture is deliberately small: an isometric grid, rooms, desks and four agents, no dependencies.
 */
export const MOCK_EMBED_HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Office</title>
<style>
  :root { --bg:#0b0d11; --floor:#1c222b; --floor2:#212832; --line:#2b3340; --ink:#e7ecf3; --dim:#8d9aab;
          --desk:#7d5c3c; --deskTop:#96704a; --chair:#4a3a2c; --ask:#e5b64c; --room:rgba(120,170,255,.15); }
  body.light { --bg:#eef1f5; --floor:#e3e8ee; --floor2:#dbe2ea; --line:#c8d1dc; --ink:#1d2430; --dim:#5a6776;
               --desk:#c09163; --deskTop:#d0a273; --chair:#a98f6f; --ask:#b7791f; --room:rgba(70,120,200,.16); }
  html, body { margin:0; height:100%; background:var(--bg); color:var(--ink);
               font:13px/1.35 -apple-system, "IBM Plex Sans", system-ui, sans-serif; overflow:hidden; }
  canvas { display:block; touch-action:none; }
  #note { position:absolute; left:12px; bottom:10px; color:var(--dim); font-size:10.5px; }
</style></head>
<body>
<canvas id="c"></canvas>
<div id="note"></div>
<script>
(function () {
  var HOOK = '${PAGE_HOOK}';
  var state = { theme: 'dark', lang: 'en', insets: { top: 0, bottom: 0, left: 0, right: 0 }, server: '' };
  var paused = false, raf = 0, spots = [];
  var rooms = [
    { name: 'WORKBENCH-AGENT', x: 0, y: 0, w: 5, h: 4 },
    { name: 'Lounge', x: 6, y: 0, w: 3, h: 3 },
    { name: 'PCB design', x: 4, y: 3, w: 5, h: 4 }
  ];
  var agents = [
    { id: 'wbo:ses_demo1', name: 'Sensor rail', job: 'debugging', x: 1, y: 1 },
    { id: 'wbo:ses_demo2', name: 'OTA image', job: 'writing docs', x: 3, y: 2, ask: true },
    { id: 'wbo:ses_demo3', name: 'Firmware', job: 'coffee', x: 7, y: 2 },
    { id: 'wbo:ses_demo4', name: 'PCB design', job: 'thinking', x: 6, y: 5 }
  ];
  var c = document.getElementById('c'), ctx = c.getContext('2d');
  var TW = 34, TH = 17, cx = 0, cy = 0;

  function post(m) {
    var text = JSON.stringify(m);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(text);
    else if (window.parent && window.parent !== window) window.parent.postMessage(text, '*');
  }
  window[HOOK] = function (raw) {
    var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!m || !m.type) return;
    if (m.type === 'hello') {
      state.theme = m.theme === 'light' ? 'light' : 'dark';
      state.lang = m.lang === 'tr' ? 'tr' : 'en';
      state.insets = m.insets || state.insets;
      state.server = m.server || '';
      document.body.className = state.theme === 'light' ? 'light' : '';
      draw();
      sayState();
    } else if (m.type === 'pause') { paused = true; cancelAnimationFrame(raf); }
    else if (m.type === 'resume') { if (paused) { paused = false; tick(); } }
  };

  function size() {
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var w = window.innerWidth, h = window.innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The grid fits the window: a diamond 9 tiles across the middle, with room for the names under it.
    TW = Math.max(22, Math.min(44, Math.floor((w - 28) / 9)));
    TH = Math.round(TW / 2);
    return { w: w, h: h };
  }
  function iso(x, y) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 }; }
  function diamond(x, y, fill) {
    var p = iso(x, y);
    ctx.beginPath();
    ctx.moveTo(cx + p.x, cy + p.y);
    ctx.lineTo(cx + p.x + TW / 2, cy + p.y + TH / 2);
    ctx.lineTo(cx + p.x, cy + p.y + TH);
    ctx.lineTo(cx + p.x - TW / 2, cy + p.y + TH / 2);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 0.5; ctx.stroke();
  }
  function css(name) { return getComputedStyle(document.body).getPropertyValue(name); }

  function draw() {
    var s = size(), i, j, p;
    ctx.clearRect(0, 0, s.w, s.h);
    spots = [];
    // the middle of the built part of the grid, a little above the window's middle
    var mid = iso(4.5, 3.2);
    cx = Math.round(s.w / 2 - mid.x);
    cy = Math.round(s.h / 2 - mid.y - 40);
    for (var y = -1; y < 9; y++) for (var x = -1; x < 9; x++) diamond(x, y, (x + y) % 2 ? css('--floor') : css('--floor2'));
    // the rooms: a tint over their tiles, and their name under them
    for (i = 0; i < rooms.length; i++) {
      var r = rooms[i];
      for (var ty = 0; ty < r.h; ty++) for (var tx = 0; tx < r.w; tx++) {
        p = iso(r.x + tx, r.y + ty);
        ctx.beginPath();
        ctx.moveTo(cx + p.x, cy + p.y);
        ctx.lineTo(cx + p.x + TW / 2, cy + p.y + TH / 2);
        ctx.lineTo(cx + p.x, cy + p.y + TH);
        ctx.lineTo(cx + p.x - TW / 2, cy + p.y + TH / 2);
        ctx.closePath();
        ctx.fillStyle = css('--room'); ctx.fill();
      }
      var at = iso(r.x + 0.5, r.y);
      ctx.fillStyle = css('--dim');
      ctx.font = '600 ' + Math.round(TW * 0.26) + 'px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label(r.name), cx + at.x - TW * 0.2, cy + at.y - TH * 0.15);
    }
    // a desk per agent, its slab a little forward of the tile
    for (i = 0; i < agents.length; i++) {
      var a = agents[i], d = iso(a.x, a.y);
      var dx = cx + d.x, dy = cy + d.y + TH * 0.5;
      ctx.fillStyle = css('--desk');
      ctx.beginPath();
      ctx.moveTo(dx, dy - TH * 0.34);
      ctx.lineTo(dx + TW * 0.42, dy);
      ctx.lineTo(dx, dy + TH * 0.34);
      ctx.lineTo(dx - TW * 0.42, dy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = css('--deskTop');
      ctx.beginPath();
      ctx.moveTo(dx, dy - TH * 0.5);
      ctx.lineTo(dx + TW * 0.42, dy - TH * 0.16);
      ctx.lineTo(dx, dy + TH * 0.18);
      ctx.lineTo(dx - TW * 0.42, dy - TH * 0.16);
      ctx.closePath(); ctx.fill();
    }
    // the agents: a shadow, a body, a head, and a name chip under the feet
    for (i = 0; i < agents.length; i++) {
      var ag = agents[i], q = iso(ag.x, ag.y);
      var px = Math.round(cx + q.x), py = Math.round(cy + q.y + TH * 0.5);
      spots.push({ id: ag.id, x: px, y: py - 10 });
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(px, py + 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ag.ask ? '#e9edf3' : '#c9d4e3';
      ctx.fillRect(px - 5, py - 16, 11, 16);                 // body
      ctx.fillStyle = '#3f4b5c';
      ctx.fillRect(px - 4, py - 4, 3, 4); ctx.fillRect(px + 2, py - 4, 3, 4);   // legs
      ctx.fillStyle = '#f0c9a4';
      ctx.fillRect(px - 4, py - 25, 9, 9);                   // head
      ctx.fillStyle = '#2b3440';
      ctx.fillRect(px - 4, py - 25, 9, 3);                   // hair
      if (ag.ask) {
        ctx.fillStyle = css('--ask');
        ctx.beginPath(); ctx.arc(px + 9, py - 33, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#171a20'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('?', px + 9, py - 29);
      }
    }
    // the names last, so no desk or head covers them
    for (i = 0; i < agents.length; i++) {
      var a2 = agents[i], q2 = iso(a2.x, a2.y);
      var nx = Math.round(cx + q2.x), ny = Math.round(cy + q2.y + TH * 0.5) + 8;
      ctx.font = '9.5px ui-monospace, monospace';
      var text = a2.name;
      var w2 = ctx.measureText(text).width + 8;
      ctx.fillStyle = state.theme === 'light' ? 'rgba(255,255,255,.85)' : 'rgba(10,13,17,.78)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(nx - w2 / 2, ny, w2, 14, 4); ctx.fill(); }
      else ctx.fillRect(nx - w2 / 2, ny, w2, 14);
      ctx.fillStyle = css('--ink');
      ctx.textAlign = 'center';
      ctx.fillText(text, nx, ny + 9.5);
    }
    document.getElementById('note').textContent =
      state.lang === 'tr' ? 'Web sayfası gelene kadar yer tutucu' : 'Stand-in until the web embed lands';
  }

  function sayState() {
    post({ type: 'state', floor: state.lang === 'tr' ? 'Zemin kat' : 'Ground floor', agents: agents.length });
  }
  function label(name) { return name.length > 20 ? name.slice(0, 19) + '…' : name; }
  function tick() {
    if (paused) return;
    draw();
    raf = requestAnimationFrame(function () { setTimeout(tick, 1200); });
  }

  c.addEventListener('pointerdown', function (e) {
    var best = null, bestD = 26;
    for (var i = 0; i < spots.length; i++) {
      var d = Math.hypot(spots[i].x - e.clientX, spots[i].y - e.clientY);
      if (d < bestD) { best = spots[i]; bestD = d; }
    }
    if (best) post({ type: 'open', agent: best.id });
  });
  window.addEventListener('resize', draw);

  document.body.className = '';
  draw();
  post({ type: 'ready' });
  sayState();
  tick();
})();
</script>
</body></html>`;
