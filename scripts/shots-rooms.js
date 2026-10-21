/**
 * A room read ten lines at a time (1.5.5), against the made-up server: it
 * opens at the newest line, an older page comes in at the top with a small
 * loader and the place kept. Run by scripts/shots.sh with SHOTS=rooms.
 */
const puppeteer = require('puppeteer');

/** The live streams the page read (S2): stream names, never a token in an address, always the header. */
function watchS2(page) {
  const seen = { reads: {}, bad: 0, quiet: 0 };
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/me/orchestrator/events?via=s2')) seen.quiet++;
    const m = u.match(/\/s2\/v1\/streams\/([^/?]+)\/records(\/tail)?/);
    if (!m) return;
    if (u.includes('token=') || !(r.headers().authorization || '').startsWith('Bearer ')) seen.bad++;
    if (m[2]) return;
    const name = decodeURIComponent(m[1]).split('/').pop();
    seen.reads[name] = (seen.reads[name] || 0) + 1;
  });
  return seen;
}


const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;
const text = (page) => page.evaluate(() => document.body.innerText);

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  const s2 = watchS2(page);
  await page.goto(MOCK, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('room-pcb'), { timeout: 10000 });
  await sleep(400);
  await page.click(tid('room-pcb'));
  await page.waitForFunction(() => document.body.innerText.includes('Line 33'), { timeout: 10000 });
  await sleep(800);
  const t1 = await text(page);
  console.log('opened: newest shown', t1.includes('Line 33'), '| line 24 loaded', t1.includes('Line 24:'), '| line 23 loaded', t1.includes('Line 23:'));
  await page.screenshot({ path: `${OUT}/50-room-opens-at-newest.png` });
  // Scroll up to the top of what is loaded: the page before comes in.
  const scrollUp = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-testid="room-list"]')][0];
    // Upside down on the web: the "top" is the end of the scroll range, as the list draws it.
    el.scrollTop = el.scrollTop < 0 ? -el.scrollHeight : el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });
  await scrollUp();
  await sleep(250);
  console.log('loader at the top', !!(await page.$(tid('room-older'))));
  await page.screenshot({ path: `${OUT}/51-room-loading-older.png` });
  await sleep(1200);
  console.log('older page in', (await text(page)).includes('Line 14:'));
  await page.screenshot({ path: `${OUT}/52-room-older-page.png` });
  await scrollUp(); await sleep(1500); await scrollUp(); await sleep(1500); await scrollUp(); await sleep(1500);
  const t3 = await text(page);
  console.log('start reached', t3.includes('Line 0:'), '| intro shown', t3.includes('keeps its own thread'));
  await page.screenshot({ path: `${OUT}/53-room-start.png` });

  // A line said here: the agent's answer comes in as the bus tells of it (1.5.9), not on a timer.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="room-list"]');
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  await sleep(800);
  await page.type(tid('composer-input'), 'Route the USB pair as 90 ohm');
  await page.click(tid('send'));
  const sent = Date.now();
  await page.waitForFunction(() => document.body.innerText.includes('On it: Route the USB pair'), { timeout: 10000 });
  console.log('agent answer shown after', Date.now() - sent, 'ms (the agent writes after 1500 ms; the safety net is 60 s)');
  await sleep(400);
  await page.screenshot({ path: `${OUT}/54-room-answer-live.png` });
  console.log('S2 reads', JSON.stringify(s2.reads), '| token in an address or no header:', s2.bad);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
