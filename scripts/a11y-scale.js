/**
 * Font scaling audit at 1.3x (the system's "larger text"): the app is drawn at 390x844, the
 * drawer and the session sheet are opened, every leaf text's font-size is multiplied by 1.3
 * (line-heights left as they are, which is what the phones do), and anything that clips is
 * printed. Pictures: the same screens before and after the scale.
 */
const puppeteer = require('puppeteer');
const MOCK = process.env.MOCK_URL || 'http://localhost:8095';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function scale(page, k) {
  await page.evaluate((k) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      if (!el.textContent || !el.textContent.trim()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (!fs) continue;
      el.style.fontSize = `${Math.round(fs * k * 100) / 100}px`;
    }
  }, k);
}

async function clipped(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      const text = el.textContent || '';
      if (!text.trim() || el.children.length) continue;
      const cs = getComputedStyle(el);
      if (cs.overflow !== 'hidden' && cs.overflowY !== 'hidden') continue;
      const over = el.scrollHeight - el.clientHeight;
      if (el.clientHeight > 0 && over > 1) out.push({ id: el.getAttribute('data-testid') || '', over, text: text.slice(0, 60) });
    }
    return out;
  });
}

async function boot(page) {
  await page.goto(MOCK, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="new-chat-screen"],[data-testid="login-email"]'),
    { timeout: 40000 },
  );
  if (await page.$(tid('login-email'))) {
    await page.type(tid('login-email'), 'ada@example.com');
    await page.type(tid('login-password'), 'mock');
    await page.click(tid('login-submit'));
  }
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 40000 });
}

async function openDrawer(page) {
  if (await page.$(tid('drawer'))) return;
  for (const id of ['wbo-open-drawer', 'wbc-open-drawer', 'room-open-drawer', 'open-drawer']) {
    const el = await page.$(tid(id));
    if (el) { await el.click(); return; }
  }
  throw new Error('no drawer button');
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 160)));

  await boot(page);

  // The drawer.
  await openDrawer(page);
  await sleep(800);
  await shot(page, 'a11y-drawer-1x');
  await scale(page, 1.3);
  await shot(page, 'a11y-drawer-1.3x');
  console.log('drawer clipped', JSON.stringify(await clipped(page)));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);

  // The session sheet's Now section.
  await openDrawer(page);
  const row = tid('agent-wbo:ses_rail0000a1');
  await page.waitForSelector(row, { timeout: 20000 });
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), row);
  await page.evaluate((sel) => document.querySelector(sel)?.click(), row);
  await page.waitForSelector(tid('wbo-column'), { timeout: 30000 });
  await sleep(900);
  await page.evaluate(() => document.querySelector('[data-testid="wbo-column"]')?.click());
  await page.waitForSelector(tid('wbo-panel'), { timeout: 20000 });
  await sleep(1200);
  for (const sec of ['model', 'files']) {
    const head = await page.$(tid(`wbo-sec-${sec}`));
    if (head) { await head.click(); await sleep(250); }
  }
  await page.evaluate(() => document.querySelector('[data-testid="wbo-sec-flow"]')?.scrollIntoView({ block: 'start' }));
  await sleep(400);
  await shot(page, 'a11y-sheet-1x');
  await scale(page, 1.3);
  await shot(page, 'a11y-sheet-1.3x');
  console.log('sheet clipped', JSON.stringify(await clipped(page)));

  // The model's numbers, open.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await openDrawer(page);
  await page.waitForSelector(row, { timeout: 20000 });
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), row);
  await page.evaluate((sel) => document.querySelector(sel)?.click(), row);
  await page.waitForSelector(tid('wbo-column'), { timeout: 30000 });
  await sleep(900);
  await page.evaluate(() => document.querySelector('[data-testid="wbo-column"]')?.click());
  await page.waitForSelector(tid('wbo-panel'), { timeout: 20000 });
  await sleep(1200);
  const modelHead = await page.$(tid('wbo-sec-model'));
  const open = await page.$(tid('wbo-panel-model'));
  if (!open && modelHead) { await modelHead.click(); await sleep(300); }
  const spend = await page.$(tid('wbo-panel-spend'));
  if (spend) { await spend.click(); await sleep(400); }
  await page.evaluate(() => document.querySelector('[data-testid="wbo-sec-model"]')?.scrollIntoView({ block: 'start' }));
  await sleep(400);
  await shot(page, 'a11y-model-1x');
  await scale(page, 1.3);
  await shot(page, 'a11y-model-1.3x');
  console.log('model clipped', JSON.stringify(await clipped(page)));

  // The light theme's waiting line: the one picture the contrast change moves (warn 3.82 -> 4.57).
  await page.evaluate(() => localStorage.setItem('wb.theme', 'github-light'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1600);
  await openDrawer(page);
  const waitRow = tid('agent-wbo:ses_ota00000b2');
  await page.waitForSelector(waitRow, { timeout: 20000 });
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), waitRow);
  await page.evaluate((sel) => document.querySelector(sel)?.click(), waitRow);
  await page.waitForSelector(tid('wbo-column'), { timeout: 30000 });
  await sleep(900);
  await page.evaluate(() => document.querySelector('[data-testid="wbo-column"]')?.click());
  await page.waitForSelector(tid('wbo-panel'), { timeout: 20000 });
  await sleep(1200);
  for (const sec of ['model', 'files']) {
    const head = await page.$(tid(`wbo-sec-${sec}`));
    if (head) { await head.click(); await sleep(250); }
  }
  await page.evaluate(() => document.querySelector('[data-testid="wbo-sec-flow"]')?.scrollIntoView({ block: 'start' }));
  await sleep(400);
  await shot(page, 'a11y-light-waiting');

  await browser.close();
})();
