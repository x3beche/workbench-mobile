/**
 * The Claude sessions (1.6.0), against the made-up server (scripts/mock-wbc.mjs):
 * the drawer's group, a session opened at its newest turn with pictures both
 * ways, an older page coming in at the top, a picture shown whole, a line
 * sent with a picture going from queued to delivered on the bus, a session
 * under an old wb-claude, one that cannot be written to, and the wide layout.
 * Run by scripts/shots.sh with SHOTS=claude.
 */
const fs = require('fs');
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, words, timeout = 10000) =>
  page.waitForFunction((w) => document.body.innerText.includes(w), { timeout }, words);

/** The live reads the page opened (S2), and any that carried a token in its address. */
function watch(page) {
  const seen = { bus: 0, bad: 0, wbc: [] };
  page.on('request', (r) => {
    const u = r.url();
    const m = u.match(/\/s2\/v1\/streams\/([^/?]+)\/records\?/);
    if (m && decodeURIComponent(m[1]).endsWith('bus')) seen.bus++;
    if (u.includes('/s2/') && u.includes('token=')) seen.bad++;
    if (u.includes('/api/wbc/')) seen.wbc.push(`${r.method()} ${new URL(u).pathname}${new URL(u).search}`);
  });
  return seen;
}

async function signIn(page) {
  await page.goto(MOCK, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
}

/** A finger dragged across the top bar by dx: a swipe to the right pulls the account's activity out. */
async function dragBar(page, dx) {
  const box = await (await page.$('[data-testid="chat-header"]')).boundingBox();
  const y = box.y + box.height / 2;
  const x0 = dx > 0 ? box.x + 40 : box.x + box.width - 40;
  await page.touchscreen.touchStart(x0, y);
  for (let i = 1; i <= 12; i++) {
    await page.touchscreen.touchMove(x0 + (dx * i) / 12, y);
    await sleep(16);
  }
  await page.touchscreen.touchEnd();
  await sleep(800);
}

(async () => {
  // A picture to send, as a phone's gallery would give it.
  const board = Buffer.from(await (await fetch(`${MOCK}/api/wbc/sessions/a1b2c3d4-rail/images/rp1/1`)).arrayBuffer());
  fs.writeFileSync('/tmp/board.png', board);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  const seen = watch(page);
  await signIn(page);

  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('drawer-wbc'), { timeout: 10000 });
  await sleep(500);
  const d = await text(page);
  console.log('drawer: group', d.includes('Claude sessions'), '| no count', !/Claude sessions · \d/.test(d),
    '| one plain line each', !d.includes('at the prompt · ada-laptop') && !d.includes('working · workstation'));
  await page.screenshot({ path: `${OUT}/90-drawer-claude-sessions.png` });

  await page.click(tid('wbc-a1b2c3d4-rail'));
  await waitText(page, 'DRC found');
  await sleep(1200);
  const t1 = await text(page);
  console.log('session: newest shown', t1.includes('DRC found'), '| from Workbench', t1.includes('from Workbench'),
    '| read by a tool', t1.includes('read by a tool'), '| a picture gone', t1.includes('pictures no longer kept'),
    '| step 8 not yet', !t1.includes('Step 8:'), '| composer', !!(await page.$(tid('wbc-composer'))));
  await page.screenshot({ path: `${OUT}/91-claude-session.png` });

  // The bar swiped to the right: the account's activity, the same bar as the Chat's.
  await dragBar(page, 150);
  await page.screenshot({ path: `${OUT}/91d-claude-activity.png` });
  await dragBar(page, -150);

  // Claude Code's suggestion in the empty box; Use puts it in, and the box is emptied again.
  const ph = await page.$eval(tid('composer-input'), (el) => el.getAttribute('placeholder'));
  console.log('suggestion as placeholder', ph.includes('0.15 mm'), '| Use chip', !!(await page.$(tid('composer-use-suggestion'))));
  await page.screenshot({ path: `${OUT}/91b-claude-suggestion.png`, clip: { x: 0, y: 844 - 220, width: 390, height: 220 } });
  await page.click(tid('composer-use-suggestion'));
  await sleep(300);
  console.log('taken', (await page.$eval(tid('composer-input'), (el) => el.value)).includes('0.15 mm'),
    '| chip gone', !(await page.$(tid('composer-use-suggestion'))));
  await page.screenshot({ path: `${OUT}/91c-claude-suggestion-used.png`, clip: { x: 0, y: 844 - 220, width: 390, height: 220 } });
  await page.click(tid('composer-input'), { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="composer-input"]');
    if (el.value) { el.select(); document.execCommand('delete'); }
  });
  await sleep(200);

  // Up to the top of what is read: the page before comes in.
  const scrollUp = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="wbc-list"]');
      el.scrollTop = el.scrollTop < 0 ? -el.scrollHeight : el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
  await scrollUp();
  await sleep(250);
  console.log('loader at the top', !!(await page.$(tid('wbc-older'))));
  await page.screenshot({ path: `${OUT}/92-claude-older.png` });
  await sleep(1300);
  console.log('older page in', (await text(page)).includes('Step 8:'));
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="wbc-list"]');
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  await sleep(800);

  // A thumbnail opened whole.
  const pics = await page.$$(tid('wbc-pic'));
  console.log('thumbnails', pics.length);
  if (pics.length) {
    await pics[0].click();
    await page.waitForSelector(tid('wbc-viewer'), { timeout: 5000 });
    await sleep(500);
    await page.screenshot({ path: `${OUT}/93-claude-viewer.png` });
    await page.click(tid('wbc-viewer-close'));
    await sleep(400);
  }

  // A line with a picture: queued, waiting while Claude works, delivered, then in the conversation.
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), page.click(tid('wbc-attach'))]);
  await chooser.accept(['/tmp/board.png']);
  await page.waitForSelector(tid('wbc-unpick-0'), { timeout: 5000 });
  await page.type(tid('composer-input'), 'Check the pads on this board');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/94-claude-compose.png` });
  await page.click(tid('send'));
  const sent = Date.now();
  await waitText(page, 'queued — Claude is working');
  console.log('waiting shown after', Date.now() - sent, 'ms');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/95-claude-queued.png` });
  await waitText(page, 'On it: Check the pads');
  console.log('answer shown after', Date.now() - sent, 'ms (the mock answers at 3600 ms; the safety net is 30 s)');
  await sleep(800);
  const t2 = await text(page);
  console.log('pending gone once shown', !t2.includes('queued —') && !t2.includes('delivered'));
  await page.screenshot({ path: `${OUT}/96-claude-delivered.png` });

  // Under an old wb-claude: "update wb-claude", no pictures.
  await page.click(tid('wbc-open-drawer'));
  await sleep(400);
  await page.click(tid('wbc-e5f6a7b8-ota'));
  await waitText(page, 'ota_guard');
  await page.click(tid('wbc-attach'));
  await sleep(300);
  const t3 = await text(page);
  console.log('outdated: tag', t3.includes('update wb-claude'), '| told to update for pictures', t3.includes('Update wb-claude on that computer'));
  await page.screenshot({ path: `${OUT}/97-claude-outdated.png` });

  // Ended, no wb-claude: the note in place of the box.
  await page.click(tid('wbc-open-drawer'));
  await sleep(400);
  await page.click(tid('wbc-9c0d1e2f-review'));
  await waitText(page, 'four 0.4 mm hooks');
  await sleep(300);
  console.log('note', !!(await page.$(tid('wbc-why'))), '| no composer', !(await page.$(tid('wbc-composer'))));
  await page.screenshot({ path: `${OUT}/98-claude-note.png` });

  // Wide: the drawer a column beside it.
  await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 });
  await page.waitForSelector(tid('wbc-a1b2c3d4-rail'), { timeout: 10000 });
  await page.click(tid('wbc-a1b2c3d4-rail'));
  await waitText(page, 'DRC found');
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/99-claude-wide.png` });

  console.log('bus reads', seen.bus, '| token in an address', seen.bad);
  console.log('wbc requests', seen.wbc.length, [...new Set(seen.wbc.map((x) => x.replace(/\?.*/, '')))].join(' '));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
