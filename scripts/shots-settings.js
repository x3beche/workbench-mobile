/**
 * Settings and Analytics (1.5.7), against the made-up server: Settings from
 * the account at the foot of the drawer (accounts, Agent & LLM, language,
 * the themes, Claude pool), Analytics from the drawer (models, spend, tools, Orchestrator,
 * job pool, sandboxes), the app in Turkish, and a light theme. Run by
 * scripts/shots.sh with SHOTS=settings.
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
  const s2 = watchS2(page);
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
  // Activity, live through the account's `activity` stream (1.5.9): its figures and last readings.
  await page.waitForSelector(tid('analytics-activity-live'), { timeout: 15000 });
  await sleep(4000);
  await scrollTo(page, 'group-work');
  await shot(page, '81-analytics-activity');
  console.log('activity live through S2', !!(await page.$(tid('analytics-activity-live'))));

  // Settings.
  await page.click(tid('analytics-open-drawer'));
  await sleep(400);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('settings-screen'));
  await shot(page, '75-settings');
  await scrollTo(page, 'settings-theme');
  await shot(page, '76-settings-themes');

  // Settings > Claude pool (1.6.2): the windows, the week's ring and its people, My sessions.
  await scrollTo(page, 'action-ccpool');
  await page.click(tid('action-ccpool'));
  await page.waitForSelector(tid('ccpool-ring'), { timeout: 10000 });
  await shot(page, '74b-ccpool');
  await scrollTo(page, 'ccpool-mine');
  await shot(page, '74c-ccpool-sessions');
  await page.click(tid('ccpool-back'));
  await page.waitForSelector(tid('settings-screen'));

  // Türkçe.
  await scrollTo(page, 'settings-language');
  const tr = await page.$$('[role="radio"]');
  for (const r of tr) if ((await r.evaluate((e) => e.innerText)) === 'Türkçe') { await r.click(); break; }
  await page.waitForFunction(() => document.body.innerText.includes('Ayarlar'), { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[data-testid="settings-screen"] [role="header"]')?.scrollIntoView());
  await shot(page, '77-settings-tr');
  await scrollTo(page, 'action-ccpool');
  await page.click(tid('action-ccpool'));
  await page.waitForSelector(tid('ccpool-ring'), { timeout: 10000 });
  await shot(page, '77b-ccpool-tr');
  await page.click(tid('ccpool-back'));
  await page.waitForSelector(tid('settings-screen'));
  await page.click(tid('settings-open-drawer'));
  await sleep(300);
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '78-analytics-tr');

  // A light theme: the choice is read when the app starts.
  await page.evaluate(() => localStorage.setItem('wb.theme', 'github-light'));
  await page.reload({ waitUntil: 'domcontentloaded' }); // live reads stay open: the network is never idle
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });
  await page.click(tid('open-drawer'));
  await sleep(300);
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '79-analytics-light');

  // Wide: two cards a row.
  await page.evaluate(() => localStorage.setItem('wb.theme', 'spartan-dark'));
  await page.reload({ waitUntil: 'domcontentloaded' }); // live reads stay open: the network is never idle
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
  await page.waitForSelector(tid('open-analytics'), { timeout: 20000 });
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '80-analytics-wide');
  console.log('S2 reads', JSON.stringify(s2.reads), '| token in an address or no header:', s2.bad);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
