/**
 * OpenCode's column on the phone (1.9.21), against the made-up server: the sheet
 * beside a session - the files with their +12 −3, the scratch files folded and
 * open, the five tools with their share. Run by scripts/shots.sh with SHOTS=panel.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(700);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) console.log(`WARN ${name}: horizontal overflow ${over}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
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

  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('drawer-wbo'), { timeout: 10000 });
  await sleep(600);
  await page.evaluate(() => document.querySelector('[data-testid="drawer-wbo"]').scrollIntoView({ block: 'center' }));
  await page.click(tid('wbo-ses_rail0000a1'));
  await page.waitForSelector(tid('wbo-column'), { timeout: 15000 });
  await sleep(1200);
  await shot(page, '96-column-session');
  await page.click(tid('wbo-column'));
  await page.waitForSelector(tid('wbo-panel'), { timeout: 15000 });
  await sleep(1500);
  await shot(page, '97-column-files');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="wbo-sec-files"]');
    el?.scrollIntoView({ block: 'center' });
  });
  await sleep(600);
  await shot(page, '98-column-files-numbers');
  const temp = await page.$(tid('wbo-panel-tempfiles'));
  if (temp) {
    await temp.click();
    await sleep(600);
    await shot(page, '99-column-temp-open');
  } else {
    console.log('WARN no temporary files row');
  }
  await browser.close();
})();
