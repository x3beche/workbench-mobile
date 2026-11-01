/**
 * The Office at phone size (docs/OFFICE.md, #72cbd0): the screen as it opens, hosting the web's own embed page.
 *
 * Run with the mock server in front of the web build (scripts/dev-proxy.mjs):
 *   MOCK=1 PORT=8091 node scripts/dev-proxy.mjs
 *   docker run ... scripts/shots-office.js
 *
 * The app draws none of the office: it hosts `/office/embed` in a WebView (an iframe in the web build, which is
 * what these pictures are taken from). Until that page lands the server answers `ready: false` and the app draws
 * its stand-in - the same screen, the same bridge - so this shot shows the host, the bar and the bridge's own
 * state line. `MOCK_OFFICE_EMBED=/some/address` on the proxy takes the real-page branch instead.
 *
 * SHOT_HOUR=21 puts the phone's clock at 21:30 Istanbul for the picture.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const NAME = process.env.NAME || '151-office-embed';
const HOUR = process.env.SHOT_HOUR ? Number(process.env.SHOT_HOUR) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) console.log(`WARN ${name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (HOUR !== null && Number.isFinite(HOUR)) {
    // The office's hour, for the picture: the phone's clock moved to HOUR:30 Istanbul today, and running on.
    await page.evaluateOnNewDocument((hour) => {
      const Real = Date;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Real());
      const delta = Real.parse(`${day}T${String(hour).padStart(2, '0')}:30:00+03:00`) - Real.now();
      class FakeDate extends Real {
        constructor(...args) {
          if (args.length === 0) super(FakeDate.now());
          else super(...args);
        }
        static now() {
          return Real.now() + delta;
        }
      }
      window.Date = FakeDate;
    }, HOUR);
  }
  await page.goto(MOCK, { waitUntil: 'networkidle0', timeout: 60000 });

  // The web build asks for a server first: the proxy's own address, then the made-up account.
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

  // The host: the iframe, the bar (the page's own `state` line), and the clock.
  await page.waitForSelector(tid('office-embed'), { timeout: 20000 });
  await page.waitForFunction(
    () => !!document.querySelector(`${'[data-testid="office-embed"]'} iframe`),
    { timeout: 20000 },
  );
  await sleep(1800); // the stand-in's first paint and its `ready`
  await shot(page, NAME);

  await browser.close();
})();
