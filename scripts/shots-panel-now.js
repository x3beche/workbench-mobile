/**
 * The panel sheet's Now section (the round 5-7 shape) in the four states the docs owed a picture of:
 * a working run with a long `cd …` command, one waiting for an answer, one that went quiet (the stall
 * line), one whose last step failed - and the working one again in the light theme. 390 px, against the
 * made-up server (scripts/mock-wbo.mjs, whose panel varies by session). Run by scripts/shots.sh with
 * SHOTS=panel-now.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

const STATES = [
  ['ses_rail0000a1', '128-wbo-now-working'],
  ['ses_ota00000b2', '129-wbo-now-waiting'],
  ['ses_pwr00000f1', '130-wbo-now-stalled'],
  ['ses_off00000e5', '131-wbo-now-failed'],
];

async function shot(page, name) {
  await sleep(700);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) console.log(`WARN ${name}: horizontal overflow ${over}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function boot(page) {
  await page.goto(MOCK, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  // The mock starts signed in, but a fresh browser has no session: the sign-in screen takes the mock password.
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="new-chat-screen"],[data-testid="login-email"]'),
    { timeout: 30000 },
  );
  if (await page.$(tid('login-email'))) {
    await page.type(tid('login-email'), 'ada@example.com');
    await page.type(tid('login-password'), 'mock');
    await page.click(tid('login-submit'));
  }
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 30000 });
}

/** The menu that opens the drawer, whatever screen the app came back to after a reload. */
async function openDrawer(page) {
  for (const id of ['wbo-open-drawer', 'wbc-open-drawer', 'room-open-drawer', 'open-drawer', 'orch-open-drawer']) {
    const el = await page.$(tid(id));
    if (el) {
      await el.click();
      return;
    }
  }
  throw new Error('no drawer button on the screen');
}

/** The sheet with its model and files folded, scrolled to the run's own section and the steps under it. */
async function nowSheet(page, sid, name) {
  await openDrawer(page);
  // The drawer is one group when the sessions are agents of each other: their rows are `agent-wbo:<sid>`.
  const row = tid(`agent-wbo:${sid}`);
  await page.waitForSelector(row, { timeout: 20000 });
  await sleep(400);
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: 'center' });
  }, row);
  await page.click(row);
  await page.waitForSelector(tid('wbo-column'), { timeout: 15000 });
  await sleep(900);
  await page.click(tid('wbo-column'));
  await page.waitForSelector(tid('wbo-panel'), { timeout: 15000 });
  await sleep(1200);
  for (const sec of ['model', 'files']) {
    const head = await page.$(tid(`wbo-sec-${sec}`));
    if (head) {
      await head.click();
      await sleep(250);
    }
  }
  await page.evaluate(() => {
    document.querySelector('[data-testid="wbo-sec-flow"]')?.scrollIntoView({ block: 'start' });
  });
  await sleep(500);
  await shot(page, name);
}

/** A session's sheet at its model, without folding it: the spending line, and the caches a tap opens. */
async function modelSheet(page, sid, name) {
  await openDrawer(page);
  const row = tid(`agent-wbo:${sid}`);
  await page.waitForSelector(row, { timeout: 20000 });
  await sleep(400);
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: 'center' });
  }, row);
  await page.click(row);
  await page.waitForSelector(tid('wbo-column'), { timeout: 15000 });
  await sleep(900);
  await page.click(tid('wbo-column'));
  await page.waitForSelector(tid('wbo-panel'), { timeout: 15000 });
  await sleep(1200);
  await page.evaluate(() => {
    document.querySelector('[data-testid="wbo-sec-model"]')?.scrollIntoView({ block: 'start' });
  });
  await sleep(500);
  await shot(page, name);
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 160));
  });

  await boot(page);
  for (const [sid, name] of STATES) {
    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1200);
    await nowSheet(page, sid, name);
  }

  // The light theme is read when the app starts, so the working state is opened again after a reload.
  await page.evaluate(() => localStorage.setItem('wb.theme', 'github-light'));
  await sleep(500);
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1500);
  await nowSheet(page, 'ses_rail0000a1', '132-wbo-now-light');

  // The spending line: the caches wait under it, and open on a tap (a session the Now shots left unfolded).
  await page.evaluate(() => localStorage.setItem('wb.theme', 'spartan-dark'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await modelSheet(page, 'ses_lid00000c3', '133-wbo-spend-closed');
  await page.click(tid('wbo-panel-spend'));
  await sleep(400);
  await shot(page, '134-wbo-spend-open');

  await browser.close();
})();
