/**
 * Several accounts (1.5.6), against the made-up server: the account of
 * before carried over, a second one added on the same server, the switcher
 * in Account, a switch back. Run by scripts/shots.sh with SHOTS=accounts.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(500);
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

  // A second account on the same server.
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('open-account'));
  await sleep(400);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('account-add'));
  await page.click(tid('account-add'));
  await page.waitForSelector(tid('server-connect'));
  await shot(page, '60-add-account-server');
  await page.click(tid('server-connect'));
  await page.waitForSelector(tid('login-email'), { timeout: 10000 });
  await page.type(tid('login-email'), 'bora.kaya@example.com');
  await page.type(tid('login-password'), 'mock');
  await shot(page, '61-add-account-login');
  await page.click(tid('login-submit'));
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes('Bora'), { timeout: 10000 });
  console.log('signed in as the second account');

  // The switcher: both accounts, the open one marked.
  await page.click(tid('open-drawer'));
  await sleep(400);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('accounts'));
  await shot(page, '62-accounts');

  // Back to Ada.
  const rows = await page.$$('[data-testid^="account-a"]');
  for (const r of rows) {
    const t = await r.evaluate((e) => e.innerText);
    if (t.includes('Ada')) {
      await r.click();
      break;
    }
  }
  await page.waitForFunction(() => document.body.innerText.includes('Ada'), { timeout: 10000 });
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await page.click(tid('open-drawer'));
  await sleep(500);
  await shot(page, '63-switched-back');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
