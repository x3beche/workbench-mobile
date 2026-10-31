/**
 * The session's title line after the COMPUTER section went (1.9.28): the computer is in the header's subtitle
 * ("<state> · OpenCode · <computer>", the dot's colour carrying the connection) and the folder is the line
 * under the sheet's title, shortened from its start. Run by scripts/shots.sh with SHOTS=wbo-title.
 *
 * Four 390 px pictures: a computer that is there, one that is away (the hairline grey dot, no "connected"
 * word), the sheet's folder (and no COMPUTER section), and an old wb-opencode's warn word.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, words, timeout = 15000) =>
  page.waitForFunction((w) => document.body.innerText.includes(w), { timeout }, words);

async function shot(page, name) {
  await sleep(700);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) console.log(`WARN ${name}: horizontal overflow ${over}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function openSession(page, sid, words) {
  // the chat list's drawer button is "open-drawer"; a session's own is "wbo-open-drawer"
  await page.click(tid((await page.$(tid('wbo-open-drawer'))) ? 'wbo-open-drawer' : 'open-drawer'));
  await page.waitForSelector(tid(`wbo-ses_${sid}`), { timeout: 15000 });
  await sleep(400);
  await page.evaluate(() => document.querySelector('[data-testid="drawer-wbo"]')?.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await page.click(tid(`wbo-ses_${sid}`));
  await waitText(page, words);
  await sleep(900);
}

async function openSheet(page) {
  await page.click(tid('wbo-column'));
  await page.waitForSelector(tid('wbo-panel'), { timeout: 15000 });
  await sleep(1200);
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 160)));
  await page.goto(MOCK, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });

  // A computer that is there: "<state> · OpenCode · ada-laptop", its dot not a word.
  await openSession(page, 'rail0000a1', 'OpenCode · ada-laptop');
  const there = await page.evaluate(
    (el) => el.textContent,
    await page.$(tid('wbo-state')),
  );
  console.log('connected:', there === 'waiting · OpenCode · ada-laptop', '|', there, '| no "connected" word',
    !/connected/i.test(there));
  await shot(page, '110-wbo-header-connected');

  // The sheet: the folder under its title, and no COMPUTER section.
  await openSheet(page);
  const sheet = await text(page);
  console.log('sheet: folder', sheet.includes('~/projects/sensor-board'), '| no COMPUTER', !sheet.includes('COMPUTER'));
  await shot(page, '111-wbo-sheet-folder');
  await page.click(tid('wbo-panel-close'));
  await sleep(600);

  // A computer that is away: the grey dot carries it, and the folder gives way in the middle.
  await openSession(page, 'off00000e5', 'OpenCode · x33-workstation');
  await shot(page, '112-wbo-header-away');
  await openSheet(page);
  const away = await text(page);
  console.log('away sheet: shortened folder', away.includes('~/…/redline-studio/app'), '| no COMPUTER',
    !away.includes('COMPUTER'));
  await shot(page, '113-wbo-sheet-folder-away');
  await page.click(tid('wbo-panel-close'));
  await sleep(600);

  // An old wb-opencode that cannot update itself: one small warn word in the same line.
  await openSession(page, 'ota00000b2', 'OpenCode · workstation');
  const old = await text(page);
  const oldState = await page.evaluate((el) => el.textContent, await page.$(tid('wbo-state')));
  console.log('outdated:', old.includes('update'), '| header', oldState);
  await shot(page, '114-wbo-header-update');

  await browser.close();
})();
