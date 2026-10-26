/**
 * The OpenCode sessions and the groups' folds and pins (1.6.1), against the
 * made-up server (scripts/mock-wbo.mjs): the drawer's groups (the newest five
 * and "Show N more", a pinned one), a session opened at its newest message
 * with OpenCode's question waiting, older turns coming in at the top, the
 * question answered from the phone and OpenCode's answer streamed on S2, a
 * line sent with a picture, a permission under an old wb-opencode, a session
 * that cannot be written to, a group folded with its pinned one in sight,
 * and the wide layout. Run by scripts/shots.sh with SHOTS=opencode.
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

function watch(page) {
  const seen = { wbo: 0, bad: 0, api: [] };
  page.on('request', (r) => {
    const u = r.url();
    const m = u.match(/\/s2\/v1\/streams\/([^/?]+)\/records\?/);
    if (m && decodeURIComponent(m[1]).endsWith('wbo')) seen.wbo++;
    if (u.includes('/s2/') && u.includes('token=')) seen.bad++;
    if (u.includes('/api/wbo/') || u.includes('/api/me/side')) seen.api.push(`${r.method()} ${new URL(u).pathname}`);
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

const scrollList = (page, top) =>
  page.evaluate((up) => {
    const el = document.querySelector('[data-testid="wbo-list"]');
    if (!el) return;
    el.scrollTop = up ? (el.scrollTop < 0 ? -el.scrollHeight : el.scrollHeight) : 0;
    el.dispatchEvent(new Event('scroll'));
  }, top);

(async () => {
  const board = Buffer.from(await (await fetch(`${MOCK}/api/wbc/sessions/a1b2c3d4-rail/images/rp1/1`)).arrayBuffer());
  fs.writeFileSync('/tmp/board.png', board);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  const seen = watch(page);
  await signIn(page);

  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('drawer-wbo'), { timeout: 10000 });
  await sleep(600);
  // The drawer scrolls to its groups.
  await page.evaluate(() => document.querySelector('[data-testid="drawer-wbo"]').scrollIntoView({ block: 'center' }));
  await sleep(300);
  const d = await text(page);
  console.log(
    'drawer: group',
    d.includes('OpenCode sessions · 8'),
    '| waiting',
    d.includes('waiting for your answer · ada-laptop'),
    '| show more',
    /Show \d+ more/.test(d),
    '| pinned old one',
    d.includes('Motor driver thermal'),
  );
  await page.screenshot({ path: `${OUT}/81-drawer-opencode.png` });

  await page.click(tid('wbo-ses_rail0000a1'));
  await waitText(page, 'Which change should go on the schematic?');
  await sleep(1200);
  const t1 = await text(page);
  console.log(
    'session: ask',
    t1.includes('Swap FB2'),
    '| waiting',
    t1.includes('waiting for your answer'),
    '| from Workbench',
    t1.includes('from Workbench'),
    '| step 3 not yet',
    !t1.includes('Step 3:'),
  );
  await page.screenshot({ path: `${OUT}/82-opencode-ask.png` });

  // Up: earlier turns, ten at a time.
  await scrollList(page, true);
  await sleep(900);
  await scrollList(page, true);
  await sleep(900);
  console.log('older turns in', (await text(page)).includes('Step 8:'));
  await page.screenshot({ path: `${OUT}/83-opencode-older.png` });
  await scrollList(page, false);
  await sleep(600);

  // The tools opened: Ran N tools, then a row.
  // The question answered from here: one option, one of several, Answer.
  await page.click(tid('ask-opt-q0-swap'));
  await page.click(tid('ask-opt-q1-cap'));
  await sleep(200);
  await page.screenshot({ path: `${OUT}/84-opencode-choose.png` });
  await page.click(tid('ask-answer'));
  await waitText(page, 'answered from the Chat');
  await waitText(page, 'added C31', 15000);
  await sleep(1500);
  const t2 = await text(page);
  console.log(
    'answered: chosen shown',
    t2.includes('Swap FB2'),
    '| streamed on wbo',
    t2.includes('beside the radio module'),
  );
  await page.screenshot({ path: `${OUT}/85-opencode-answered.png` });

  // A line with a picture: sent - waiting for the computer, delivered, OpenCode answers live.
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), page.click(tid('wbo-attach'))]);
  await chooser.accept(['/tmp/board.png']);
  await page.waitForSelector(tid('wbo-unpick-0'), { timeout: 5000 });
  await page.type(tid('composer-input'), 'Check the burst again with the new bead');
  await page.click(tid('send'));
  await waitText(page, 'sent — waiting for the computer');
  await sleep(200);
  await page.screenshot({ path: `${OUT}/86-opencode-sent.png` });
  await waitText(page, 'within 20 mV', 15000);
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/87-opencode-delivered.png` });

  // A permission under an old wb-opencode.
  await page.click(tid('wbo-open-drawer'));
  await sleep(400);
  await page.click(tid('wbo-ses_ota00000b2'));
  await waitText(page, 'OpenCode asks to run bash');
  await sleep(800);
  const t3 = await text(page);
  console.log(
    'permission: buttons',
    t3.includes('Allow once') && t3.includes('Always allow') && t3.includes('Reject'),
    '| update tag',
    t3.includes('update wb-opencode'),
  );
  await page.screenshot({ path: `${OUT}/88-opencode-permission.png` });

  // Ended, without wb-opencode: the note.
  await page.click(tid('wbo-open-drawer'));
  await sleep(400);
  await page.click(tid('wbo-ses_lid00000c3'));
  await waitText(page, 'four 0.4 mm hooks');
  await sleep(300);
  console.log('note', !!(await page.$(tid('wbo-why'))), '| no composer', !(await page.$(tid('wbo-composer'))));
  await page.screenshot({ path: `${OUT}/89-opencode-note.png` });

  // Folded: the header, the count and the dot, the pinned one still in sight; saved to /api/me/side.
  await page.click(tid('wbo-open-drawer'));
  await sleep(400);
  await page.click(tid('drawer-wbo-fold'));
  await sleep(600);
  await page.evaluate(() => document.querySelector('[data-testid="drawer-wbo"]').scrollIntoView({ block: 'center' }));
  await sleep(300);
  const side = await (await fetch(`${MOCK}/api/me/side`)).json();
  console.log(
    'folded: saved',
    side.folds.opencode === false,
    '| pinned in sight',
    (await text(page)).includes('Motor driver thermal'),
    '| others hidden',
    !(await text(page)).includes('Gerber export check'),
  );
  await page.screenshot({ path: `${OUT}/80b-drawer-folded.png` });
  await page.click(tid('drawer-wbo-fold'));
  await sleep(300);

  // Wide.
  await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 });
  await page.waitForSelector(tid('wbo-ses_rail0000a1'), { timeout: 10000 });
  await page.click(tid('wbo-ses_rail0000a1'));
  await waitText(page, 'within 20 mV');
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/89b-opencode-wide.png` });

  console.log('wbo stream reads', seen.wbo, '| token in an address', seen.bad);
  console.log('requests', [...new Set(seen.api)].join(' '));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
