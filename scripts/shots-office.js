/**
 * The Office at phone size (docs/OFFICE.md, phase 4): the drawer's row, the
 * screen as it opens, and the card a character's tap shows.
 *
 * Run with the mock server in front of the web build (scripts/dev-proxy.mjs):
 *   MOCK=1 PORT=8091 node scripts/dev-proxy.mjs
 *   docker run ... scripts/shots-office.js
 * MOCK_OFFICE=real on the proxy serves the company backend/office.py builds
 * (scripts/mock-office.mjs) instead of the compact made-up one.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const NAME = process.env.NAME || '147-office';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) console.log(`WARN ${name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(MOCK, { waitUntil: 'networkidle0', timeout: 60000 });

  // The web build asks for a server first: the proxy's own address, then the
  // made-up account (any password, when the mock starts signed out).
  await page.waitForSelector(tid('server-input'), { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="new-chat-screen"],[data-testid="login-email"]'),
    { timeout: 30000 },
  );
  if (await page.$(tid('login-email'))) {
    await page.type(tid('login-email'), 'ada@example.com');
    await page.type(tid('login-password'), 'mock');
    await page.click(tid('login-submit'));
    await page.waitForSelector(tid('new-chat-screen'), { timeout: 30000 });
  }

  // The drawer, then the Office row.
  await page.waitForSelector(tid('open-drawer'), { timeout: 30000 });
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('open-office'), { timeout: 15000 });
  await sleep(700); // the drawer is still sliding in when the row first exists
  await page.click(tid('open-office'));
  await page.waitForSelector(tid('office-view'), { timeout: 20000 });
  await page.waitForSelector('[data-testid^="office-person-"]', { timeout: 20000 });
  await sleep(1400); // the arrival walk is over
  await shot(page, NAME);

  // A character's card: the name, what it does, the task and its share.
  const who = await page.evaluate(() => {
    const p = document.querySelector('[data-testid^="office-person-"]');
    return p ? p.getAttribute('data-testid') : null;
  });
  if (who) {
    await page.click(`[data-testid="${who}"]`);
    await page.waitForSelector(tid('office-card'), { timeout: 10000 });
    await shot(page, `${NAME}-card`);
  } else {
    console.log('no character to tap');
  }

  // ×2, for the pixels themselves (whole numbers only).
  await page.click(tid('office-zoom-in'));
  await shot(page, `${NAME}-zoom`);

  await browser.close();
})();
