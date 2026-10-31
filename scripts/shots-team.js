/**
 * The manager's Team after the web's rebuild (1.9.28): one list, one block an agent - its state dot, name and
 * window share (95% from used/limit, not the stale pct the made-up server also sends), its tasks with state and
 * time at the right, and its own last word as one dim line. Run by scripts/shots.sh with SHOTS=team.
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

  // With links on the server the drawer is one Agents group (DrawerPanel's AgentGroup), not the two groups.
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('drawer-agents'), { timeout: 15000 });
  await sleep(600);
  await page.click(tid('agent-wbc:a1b2c3d4-rail'));
  await waitText(page, 'DRC found');
  await page.waitForSelector(tid('wbc-team'), { timeout: 15000 });
  await page.click(tid('wbc-team'));
  await page.waitForSelector(tid('wbc-team-sheet'), { timeout: 15000 });
  await waitText(page, 'agents ·');
  await sleep(1400);

  const list = await text(page);
  console.log(
    'counts', /4 agents · 1 working/.test(list),
    '| 95% from used/limit', list.includes('95%') && !/(^|\\s)3%/.test(list),
    '| waiting first', list.indexOf('Sensor board rail sag') < list.indexOf('OTA rollback watchdog'),
    '| idle line', /idle · last task #d4e5f6 closed \d+m/.test(list),
    '| closed at the foot', /\d+ closed/.test(list),
  );
  await shot(page, '120-team-list');

  // One agent's word opened: the same small dim type, wrapping, not the big answer paragraph.
  await page.click(tid('team-note-f6a7b8'));
  await sleep(500);
  const word = await text(page);
  console.log('word opened', /bootloader falls back to the other one/.test(word));
  await shot(page, '121-team-word');
  await page.click(tid('team-note-f6a7b8'));
  await sleep(400);

  // The closed ones at the foot, grouped by the agent that held them.
  await page.click(tid('team-closed'));
  await sleep(600);
  const closed = await text(page);
  console.log('closed: grouped', closed.includes('Enclosure lid review'), '| line', /#d4e5f6/.test(closed));
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="team-closed"]');
    el?.scrollIntoView({ block: 'center' });
  });
  await shot(page, '122-team-closed');

  await browser.close();
})();
