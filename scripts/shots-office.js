/**
 * The Office at phone size (docs/OFFICE.md, phase 4): the drawer's row, the
 * screen as it opens, and the card a character's tap shows.
 *
 * Run with the mock server in front of the web build (scripts/dev-proxy.mjs):
 *   MOCK=1 PORT=8091 node scripts/dev-proxy.mjs
 *   docker run ... scripts/shots-office.js
 * MOCK_OFFICE=real on the proxy serves the company backend/office.py builds
 * (scripts/mock-office.mjs) instead of the compact made-up one.
 *
 * SHOT_HOUR=21 puts the phone's clock at 21:30 Istanbul for the picture (the
 * office's own day, lib/office/daylight.ts): the clock in the bar says it, and
 * the drawing gets that hour's light. SHOT_PARTS=main takes only the first
 * picture (no card, no zoom). SHOT_WHO=wbc:rail opens that character's card
 * rather than the first one's.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const NAME = process.env.NAME || '147-office';
const HOUR = process.env.SHOT_HOUR ? Number(process.env.SHOT_HOUR) : null;
const PARTS = (process.env.SHOT_PARTS || 'main,card,zoom').split(',');
const WHO = process.env.SHOT_WHO || '';

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
  if (HOUR !== null && Number.isFinite(HOUR)) {
    // The office's hour, for the picture: the phone's clock is moved to HOUR:30 Istanbul today, and keeps
    // running from there (a walk still walks, the clock in the bar says this hour).
    await page.evaluateOnNewDocument((hour) => {
      const Real = Date;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Real());
      const target = Real.parse(`${day}T${String(hour).padStart(2, '0')}:30:00+03:00`);
      const delta = target - Real.now();
      class FakeDate extends Real {
        constructor(...args) {
          if (args.length === 0) super(FakeDate.now());
          else super(...args);
        }
        static now() {
          return Real.now() + delta;
        }
      }
      // eslint-disable-next-line no-global-assign
      window.Date = FakeDate;
    }, HOUR);
  }
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
  if (!PARTS.includes('card') && !PARTS.includes('zoom')) {
    await browser.close();
    return;
  }

  // A character's card: the name, what it does, the task and its share.
  const who = await page.evaluate((want) => {
    const all = [...document.querySelectorAll('[data-testid^="office-person-"]')];
    const named = want ? all.find((p) => p.getAttribute('data-testid').endsWith(want)) : null;
    const p = named || all[0];
    return p ? p.getAttribute('data-testid') : null;
  }, WHO);
  if (who && PARTS.includes('card')) {
    await page.click(`[data-testid="${who}"]`);
    await page.waitForSelector(tid('office-card'), { timeout: 10000 });
    await shot(page, `${NAME}-card`);
  } else if (PARTS.includes('card')) {
    console.log('no character to tap');
  }

  // ×2, for the pixels themselves (whole numbers only).
  if (PARTS.includes('zoom')) {
    await page.click(tid('office-zoom-in'));
    await shot(page, `${NAME}-zoom`);
  }

  await browser.close();
})();
