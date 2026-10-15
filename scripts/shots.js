/**
 * Screenshots of the web build at phone size, in headless Chrome.
 * Needs two dev proxies running (scripts/dev-proxy.mjs):
 *   LIVE: TARGET=<a real Workbench server> PORT=8090   (server and sign-in screens; one wrong-password try)
 *         or MOCK=1 MOCK_SIGNIN=1 PORT=8090            (the same against the made-up server)
 *   MOCK: MOCK=1 MOCK_HOLD=1 PORT=8091                 (everything after sign-in, made-up data)
 * Run with scripts/shots.sh. Writes docs/screenshots/*.png (OUT).
 * The sign-in check uses a made-up address and password: never real ones.
 */
const puppeteer = require('puppeteer');

const LIVE = process.env.LIVE_URL || 'http://localhost:8090';
const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) console.log(`WARN ${name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function byText(page, text) {
  const h = await page.waitForFunction(
    (t) => [...document.querySelectorAll('[role="button"],[role="radio"],button')].find((e) => e.textContent.trim() === t && e.offsetWidth),
    { timeout: 15000 },
    text,
  );
  return h.asElement();
}

async function newPage(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  return page;
}

async function connect(page, base, address) {
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.evaluate(() => document.fonts.ready);
  return async () => {
    await page.type(tid('server-input'), address);
    await page.click(tid('server-connect'));
  };
}

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  // ---- live server, through the proxy: server screen, sign-in error ----
  if (process.env.SKIP_LIVE !== '1') {
    const page = await newPage(browser);
    const go = await connect(page, LIVE, new URL(LIVE).host);
    await shot(page, '01-server');
    await go();
    await page.waitForSelector(tid('login-email'), { timeout: 20000 });
    await sleep(400);
    await shot(page, '10-login');
    await page.type(tid('login-email'), 'mobile-app-check@example.invalid');
    await page.type(tid('login-password'), 'not-a-real-password');
    await page.click(tid('login-submit'));
    await page.waitForSelector('[role="alert"]', { timeout: 30000 });
    console.log('LIVE ERROR:', await page.$eval('[role="alert"]', (e) => e.textContent));
    await page.click('input[type="password"]').catch(() => undefined);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await shot(page, '03-login-error');
    await (await byText(page, 'Change')).click();
    await page.waitForSelector(tid('server-input'));
    await shot(page, '02-server-recent');
  }

  // ---- made-up server: everything after sign-in ----
  const page = await newPage(browser);
  const go = await connect(page, MOCK, new URL(MOCK).host);
  await go();
  await page.waitForSelector(tid('chat-c1'), { timeout: 20000 });
  await shot(page, '04-chats');

  await page.click(tid('open-account'));
  await sleep(300);
  await (await byText(page, 'Türkçe')).click();
  await shot(page, '09-account');
  await (await byText(page, 'Auto')).click();
  await page.click('[aria-label="Close"]');
  await sleep(300);

  await page.click(tid('chat-c1'));
  await page.waitForSelector(tid('composer-input'));
  await sleep(800);
  await page.type(tid('composer-input'), 'Would a 1 A bead be enough, or do I need a different layout?');
  await page.click(tid('send'));
  await sleep(2500); // the made-up answer stops half-way and stays open
  await shot(page, '05-chat');

  // Typing a long line: the box grows to six lines, then scrolls inside.
  await page.type(
    tid('composer-input'),
    'The bead heats up at the burst current. Next steps:\n1. scope TP7 with the radio sending\n2. swap in the 1 A bead\n3. add 47 uF next to the module\n4. measure the dip again\n5. compare with the old board\n6. write it down in the log',
  );
  await sleep(300);
  await shot(page, '11-chat-typing');

  // The keyboard, as the web can show it: the window gets shorter by its
  // height (336 px, a phone keyboard). The composer and the newest lines
  // must stay in view above it.
  await page.setViewport({ width: 390, height: 844 - 336, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(600);
  const fit = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="composer-input"]').getBoundingClientRect();
    return { composerBottom: Math.round(box.bottom), viewport: window.innerHeight };
  });
  console.log('KEYBOARD', JSON.stringify(fit));
  await shot(page, '12-chat-keyboard');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.$eval(tid('composer-input'), (e) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(e, '');
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);

  // Scrolled up to read: the list stays put and offers the way back.
  await page.$eval(tid('chat-list'), (e) => {
    e.scrollTop = 0;
    e.dispatchEvent(new Event('scroll'));
  });
  await page.waitForSelector(tid('jump-to-latest'), { timeout: 5000 });
  await shot(page, '13-chat-scrolled-up');
  await page.click(tid('jump-to-latest'));
  await sleep(600);

  await page.click(tid('voice-start'));
  await page.waitForSelector(tid('recording-bar'), { timeout: 10000 });
  await sleep(3200);
  await shot(page, '06-voice-recording');
  await page.click(tid('voice-cancel'));
  await sleep(300);

  await page.click(tid('open-voice-note'));
  await page.waitForSelector(tid('voice-done'), { timeout: 10000 });
  await sleep(2200);
  await page.click(tid('voice-done'));
  await page.waitForSelector(tid('voice-note-text'), { timeout: 15000 });
  await shot(page, '07-voice-review');
  await (await byText(page, 'Discard')).click();
  await sleep(300);

  await page.click(tid('open-models'));
  await page.waitForFunction(() => document.body.innerText.includes('Claude Haiku 4.5'), { timeout: 10000 });
  await shot(page, '08-model-picker');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
