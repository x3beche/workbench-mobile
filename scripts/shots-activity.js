/**
 * The web top bar's Activity (1.6.3), against the made-up server: the bar
 * turned to it (1.7.4 - the activity is the bar's whole width, so every cell
 * ticked for shows), its sheet (range, figures, the chart by source, what the
 * strip shows), a range of one's own, Turkish, and the sheet from Analytics.
 * Run by scripts/shots.sh with SHOTS=activity.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

/** The bar's middle is two pages: a tap on the name turns it to the activity. */
async function turnBar(page) {
  await page.click(tid('chat-title'));
  await sleep(700);
}

/** The activity covers the bar's own buttons while it is in front: a swipe right brings the name back. */
async function backBar(page) {
  const box = await (await page.$(tid('chat-header'))).boundingBox();
  const y = box.y + box.height / 2;
  const x0 = box.x + 40;
  await page.touchscreen.touchStart(x0, y);
  for (let i = 1; i <= 12; i++) {
    await page.touchscreen.touchMove(x0 + (200 * i) / 12, y);
    await sleep(16);
  }
  await page.touchscreen.touchEnd();
  await sleep(800);
}

async function shot(page, name) {
  await sleep(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) console.log(`WARN ${name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto(MOCK, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await page.waitForSelector(tid('activity-strip'), { timeout: 15000 });
  await sleep(2500);
  await turnBar(page);
  await shot(page, '48-activity-strip');

  await page.click(tid('activity-strip'));
  await page.waitForSelector(tid('activity-sheet'));
  await shot(page, '49-activity-sheet');
  // A touch on the chart reads its column.
  const box = await (await page.$(tid('activity-area'))).boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(200);
  await shot(page, '49b-activity-reading');
  await page.mouse.up();
  // A range of one's own, a source hidden.
  await page.click(tid('activity-own-range'));
  await page.type(tid('activity-own-range'), '15m');
  await page.keyboard.press('Enter');
  await page.click(tid('activity-legend-claude'));
  await sleep(800);
  await shot(page, '49c-activity-own-range');
  // The strip without the chart and the jobs.
  await page.click(tid('activity-show-spark'));
  await page.click(tid('activity-show-jobs'));
  await page.click(tid('activity-sheet-close'));
  await sleep(400);
  await shot(page, '49d-activity-strip-own');

  // From Analytics: the drawer button is under the activity until the name is back.
  await backBar(page);
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('open-analytics'));
  await sleep(300);
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-activity-open'), { timeout: 15000 });
  await page.evaluate(() => document.querySelector('[data-testid="analytics-activity-open"]')?.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await page.click(tid('analytics-activity-open'));
  await page.waitForSelector(tid('activity-sheet'));
  await shot(page, '49e-activity-from-analytics');

  // Wide: the strip in the conversation's column.
  await page.click(tid('activity-sheet-close'));
  await sleep(300);
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(MOCK, { waitUntil: 'domcontentloaded' });
  // The page comes back to the view it was left on: a conversation with a header is what this shot is of.
  await page.waitForSelector(tid('drawer-list'), { timeout: 20000 });
  await sleep(1200);
  if (!(await page.$(tid('chat-title')))) {
    await page.click(tid('chat-c1'));
    await page.waitForSelector(tid('chat-title'), { timeout: 20000 });
    await sleep(800);
  }
  await turnBar(page);
  await shot(page, '49f-activity-wide');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
