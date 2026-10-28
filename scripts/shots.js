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
let last = null;
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
    (t) =>
      [...document.querySelectorAll('[role="button"],[role="radio"],button')].find(
        (e) => e.textContent.trim() === t && e.offsetWidth,
      ),
    { timeout: 15000 },
    text,
  );
  return h.asElement();
}

/** The drawer's list holds rooms and both session groups above the chats, so a
 *  row can start out below the fold: brought into sight first. */
async function inSight(page, selector) {
  await page.$eval(selector, (e) => e.scrollIntoView({ block: 'center' }));
  await sleep(350);
}

/** A finger swiping a row sideways by dx (touch events, as on a phone). */
async function swipe(page, selector, dx) {
  await inSight(page, selector);
  const box = await (await page.$(selector)).boundingBox();
  const y = box.y + box.height / 2;
  const x0 = dx < 0 ? box.x + box.width - 30 : box.x + 30;
  await page.touchscreen.touchStart(x0, y);
  for (let i = 1; i <= 12; i++) {
    await page.touchscreen.touchMove(x0 + (dx * i) / 12, y);
    await sleep(16);
  }
  await page.touchscreen.touchEnd();
  await sleep(600);
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
  // A first start opens on a new conversation: greeting and example questions.
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes('watchdog'), { timeout: 10000 });
  await shot(page, '04-new-chat');

  // A suggestion fills the composer, ready to edit or send.
  await page.click(tid('suggestion-1'));
  await sleep(300);
  await shot(page, '04b-suggestion');
  await page.$eval(tid('composer-input'), (e) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(e, '');
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);

  // With nothing typed, the round button records a voice note to read over before sending.
  await page.click(tid('open-voice-note'));
  await page.waitForSelector(tid('voice-done'), { timeout: 10000 });
  await sleep(2200);
  await shot(page, '15-voice-note-recording');
  await page.click(tid('voice-done'));
  await page.waitForSelector(tid('voice-note-text'), { timeout: 15000 });
  await shot(page, '16-voice-review');
  await (await byText(page, 'Discard')).click();
  await sleep(300);

  // The drawer: search, New chat, the conversations by day, the account.
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('chat-c1'), { visible: true, timeout: 10000 });
  await shot(page, '05-drawer');

  // A conversation's actions - rename, pin, archive, export, delete - from the
  // top bar's "…". (A long press on a drawer row opens the same sheet, but a
  // browser cannot hold a row still; the phone's own shots are of the sheet.)
  await page.click(tid('chat-c1'));
  await page.waitForFunction(() => document.body.innerText.includes('BLM18PG221SN1'), { timeout: 10000 });
  await sleep(500);
  await page.click(tid('header-more'));
  await page.waitForSelector(tid('chat-actions'), { timeout: 5000 });
  await shot(page, '14-chat-actions');
  await page.click('[aria-label="Close"]');
  await sleep(300);

  // Back in the drawer: a swipe to the left on a row shows Archive and Delete.
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('chat-c1'), { visible: true, timeout: 10000 });
  await swipe(page, tid('chat-c2'), -170);
  await shot(page, '22-drawer-swipe');
  await swipe(page, tid('chat-c2'), 170);

  // Archived and Trash, as tabs over the list.
  await page.click(tid('chat-scope-archived'));
  await page.waitForSelector(tid('chat-a1'), { visible: true, timeout: 5000 });
  await shot(page, '24-archived');
  await page.click(tid('chat-scope-trash'));
  await page.waitForSelector(tid('empty-trash'), { visible: true, timeout: 5000 });
  await shot(page, '25-trash');
  await page.click(tid('chat-scope-live'));
  // The list kept its place from another tab: the top of it is where the chats are.
  await page.$eval(tid('drawer-list'), (e) => {
    e.scrollTop = 0;
    e.dispatchEvent(new Event('scroll'));
  });
  await page.waitForSelector(tid('chat-c1'), { timeout: 5000 });

  await page.click(tid('open-account'));
  await page.waitForSelector(tid('account-sheet'), { timeout: 5000 });
  await (await byText(page, 'Türkçe')).click();
  await shot(page, '09-account');
  await (await byText(page, 'Auto')).click();
  await page.click('[aria-label="Close"]');
  await sleep(300);

  // A conversation with tools run and a code block.
  await page.click(tid('chat-c1'));
  await page.waitForFunction(() => document.body.innerText.includes('BLM18PG221SN1'), { timeout: 10000 });
  await sleep(500);
  await page.$eval(tid('chat-list'), (e) => {
    e.scrollTop = 0;
    e.dispatchEvent(new Event('scroll'));
  });
  await sleep(300);
  await shot(page, '06-chat');
  // The top bar's "…": rename, pin, archive, export, delete.
  await page.click(tid('header-more'));
  await page.waitForSelector(tid('chat-actions'), { timeout: 5000 });
  await shot(page, '23-header-menu');
  await page.click('[aria-label="Close"]');
  await sleep(300);
  // The work behind its one line, opened (the tool rows, with what they found),
  // and the code block copied.
  await page.click(tid('compact-work'));
  await page.$eval(tid('chat-list'), (e) => {
    e.scrollTop = e.scrollHeight;
    e.dispatchEvent(new Event('scroll'));
  });
  await sleep(300);
  await page.click(tid('copy-code')).catch(() => undefined);
  await sleep(200);
  await shot(page, '06b-chat-code');

  // A wide window (a tablet, a desktop browser): the drawer is a column that stays open.
  // Its scrollbars show, as a desktop browser's do (puppeteer hides them unless told not to).
  const desktop = await puppeteer.launch({ ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--no-sandbox'] });
  const wide = await newPage(desktop);
  await wide.setViewport({ width: 900, height: 860, deviceScaleFactor: 1 });
  const goWide = await connect(wide, MOCK, new URL(MOCK).host);
  await goWide();
  await wide.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await sleep(400);
  await shot(wide, '20-wide-new-chat');
  await wide.click(tid('chat-c1'));
  await wide.waitForFunction(() => document.body.innerText.includes('BLM18PG221SN1'), { timeout: 10000 });
  await shot(wide, '21-wide-chat');
  // The web build's scrollbars are the web app's: thin, a faint thumb on no track, brighter under the pointer.
  await wide.click(tid('open-files'));
  await wide.waitForSelector(tid('file-row-d:d2'), { timeout: 10000 });
  await wide.click(tid('file-row-d:d2'));
  await wide.waitForSelector(tid('thumb-p0'), { timeout: 10000 });
  await sleep(800);
  await wide.$eval(tid('files-list'), (e) => {
    e.scrollTop = 420;
    e.dispatchEvent(new Event('scroll'));
  });
  const list = await (await wide.$(tid('files-list'))).boundingBox();
  await wide.mouse.move(list.x + list.width / 2, list.y + 200);
  await sleep(500);
  await shot(wide, '34-wide-scrollbar');
  await desktop.close();

  // Sending: the line goes up at once, three dots wait for the answer, a tool runs, then the text comes.
  await page.type(tid('composer-input'), 'Would a 1 A bead be enough, or do I need a different layout?');
  await page.click(tid('send'));
  await sleep(120);
  await shot(page, '07-chat-waiting');
  await page.waitForFunction(() => document.body.innerText.includes('Checking FB2'), { timeout: 5000 });
  await shot(page, '07b-chat-tool-running');
  await sleep(2600); // the made-up answer stops half-way and stays open
  await shot(page, '07c-chat-streaming');

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
  if (fit.composerBottom > fit.viewport) console.log('WARN the composer is under the keyboard');
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
  await shot(page, '15b-voice-dictation');
  await page.click(tid('voice-cancel'));
  await sleep(300);

  await page.click(tid('open-models'));
  await page.waitForFunction(() => document.body.innerText.includes('Claude Haiku 4.5'), { timeout: 10000 });
  await shot(page, '08-model-picker');
  await page.click('[aria-label="Close"]');
  await sleep(300);

  // ---- Files ----
  last = page;
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('open-files'), { visible: true, timeout: 5000 });
  await sleep(500); // the drawer settles
  await page.click(tid('open-files'));
  await page.waitForSelector(tid('thumb-f1'), { timeout: 10000 });
  await sleep(2600); // the STEP's picture is made on the first ask (202), then shown
  await shot(page, '26-files');
  await page.click(tid('file-more-f:f2'));
  await page.waitForSelector(tid('file-actions'), { timeout: 5000 });
  await shot(page, '33-file-actions');
  await page.click('[aria-label="Close"]');
  await sleep(300);
  await page.click(tid('files-add'));
  await page.waitForSelector(tid('upload-sheet'), { timeout: 5000 });
  await shot(page, '30-upload-sheet');
  await page.click('[aria-label="Close"]');
  await sleep(300);

  await page.click(tid('file-row-d:d1'));
  await page.waitForSelector(tid('thumb-f5'), { timeout: 10000 });
  await sleep(500);
  await shot(page, '27-files-folder');
  await page.click(tid('file-row-f:f5'));
  await page.waitForSelector(tid('pdf-page-2'), { timeout: 10000 });
  await sleep(1200);
  await shot(page, '29-preview-pdf');
  await page.click(tid('preview-close'));
  await sleep(300);
  await page.click(tid('crumb-top'));
  await page.waitForSelector(tid('file-row-f:f1'), { timeout: 5000 });
  await page.click(tid('file-row-f:f1'));
  await page.waitForSelector(tid('preview-image'), { timeout: 10000 });
  await sleep(1200);
  await shot(page, '28-preview-image');
  await page.click(tid('preview-close'));
  await sleep(300);

  await page.click(tid('files-tabs-app'));
  await page.waitForSelector(tid('file-row-d:v:projects'), { timeout: 5000 });
  await page.click(tid('file-row-d:v:projects'));
  await page.waitForSelector(tid('file-row-d:v:pf:sensor'), { timeout: 5000 });
  await page.click(tid('file-row-d:v:pf:sensor'));
  await page.waitForSelector(tid('thumb-v:ba:layers'), { timeout: 10000 });
  await sleep(2600);
  await shot(page, '32-files-in-the-app');

  await page.click(tid('files-tabs-trash'));
  await page.waitForSelector(tid('file-row-t:t1'), { timeout: 5000 });
  await sleep(800);
  await shot(page, '31-files-deleted');

  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (last) await last.screenshot({ path: `${OUT}/zz-failed.png` }).catch(() => undefined);
  process.exit(1);
});
