/**
 * Settings and Analytics (1.5.7), against the made-up server: Settings from
 * the account at the foot of the drawer (accounts, Agent & LLM, language,
 * the themes), Analytics from the drawer (models, spend, tools, Orchestrator,
 * job pool, sandboxes), the app in Turkish, and a light theme. Run by
 * scripts/shots.sh with SHOTS=settings.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) console.log(`WARN ${name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function scrollTo(page, testID) {
  await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.scrollIntoView({ block: 'start' }), testID);
  await sleep(300);
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

  // Analytics.
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('open-analytics'));
  await sleep(400);
  await shot(page, '70-drawer-analytics');
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '71-analytics');
  await scrollTo(page, 'analytics-tools');
  await shot(page, '72-analytics-tools');
  await scrollTo(page, 'analytics-orchestrator');
  await shot(page, '73-analytics-orchestrator-pool');
  await scrollTo(page, 'analytics-sandboxes');
  await shot(page, '74-analytics-sandboxes');

  // Settings.
  await page.click(tid('analytics-open-drawer'));
  await sleep(400);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('settings-screen'));
  await shot(page, '75-settings');
  await scrollTo(page, 'settings-theme');
  await shot(page, '76-settings-themes');

  // Türkçe.
  await scrollTo(page, 'settings-language');
  const tr = await page.$$('[role="radio"]');
  for (const r of tr) if ((await r.evaluate((e) => e.innerText)) === 'Türkçe') { await r.click(); break; }
  await page.waitForFunction(() => document.body.innerText.includes('Ayarlar'), { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[data-testid="settings-screen"] [role="header"]')?.scrollIntoView());
  await shot(page, '77-settings-tr');
  await page.click(tid('settings-open-drawer'));
  await sleep(300);
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '78-analytics-tr');

  // A light theme: the choice is read when the app starts.
  await page.evaluate(() => localStorage.setItem('wb.theme', 'github-light'));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await page.click(tid('open-drawer'));
  await sleep(300);
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '79-analytics-light');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
