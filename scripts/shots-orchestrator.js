/**
 * Screenshots of the Orchestrator (1.5.4) at phone size, against the made-up
 * server (MOCK=1 node scripts/dev-proxy.mjs on MOCK_URL): the drawer with it
 * above the rooms, its live session, the agents folded open, a sub-agent's
 * session, the MCP tools, and Agent & LLM. Run by scripts/shots.sh with
 * SHOTS=orchestrator. MOCK_ORCH=halted on the proxy gives the key-refused banner.
 */
const puppeteer = require('puppeteer');

const MOCK = process.env.MOCK_URL || 'http://localhost:8091';
const OUT = process.env.OUT || '/out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function shot(page, name) {
  await sleep(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) console.log(`WARN ${name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await page.goto(MOCK, { waitUntil: 'networkidle0' });
  await page.waitForSelector(tid('server-input'));
  await page.evaluate(() => document.fonts.ready);
  await page.type(tid('server-input'), new URL(MOCK).host);
  await page.click(tid('server-connect'));
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });

  // The drawer: the Orchestrator pinned above the rooms.
  await page.click(tid('open-drawer'));
  await page.waitForSelector(tid('room-orchestrator'), { timeout: 10000 });
  await sleep(500);
  await shot(page, '40-drawer-orchestrator');

  // Its session, live: the text is written in while it is open.
  await page.click(tid('room-orchestrator'));
  await page.waitForSelector(tid('orchestrator-screen'));
  await page.waitForFunction(() => document.body.innerText.includes('Answered in'), { timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.includes('when it is clean'), { timeout: 20000 });
  await shot(page, '41-orchestrator-live');

  // A tool call opened.
  const tools = await page.$$(tid('orch-tool'));
  if (tools[0]) await tools[0].click();
  await sleep(300);
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="orch-list"]');
    if (el) el.scrollTop = 0;
  });
  await shot(page, '42-orchestrator-tool');

  // The agents, folded open above the session.
  await page.click(tid('orch-tree-toggle'));
  await page.waitForSelector(tid('orch-node-ses_cad'));
  await shot(page, '43-orchestrator-agents');

  // A sub-agent's session, with the way back.
  await page.click(tid('orch-node-ses_cad'));
  await page.waitForSelector(tid('orch-sub-back'));
  await page.waitForFunction(() => document.body.innerText.includes('Lid rebuilt'), { timeout: 10000 });
  await shot(page, '44-orchestrator-subagent');
  await page.click(tid('orch-sub-back'));
  await sleep(300);

  // The MCP tools, searched.
  await page.click(tid('orch-mcp'));
  await page.waitForSelector(tid('mcp-list'));
  await shot(page, '45-mcp-tools');
  await page.type(tid('mcp-search'), 'build');
  await shot(page, '46-mcp-search');
  await page.click(tid('mcp-sheet-close'));
  await sleep(400);

  // Agent & LLM: state, Start / Restart / Stop, provider and model.
  await page.click(tid('orch-settings'));
  await page.waitForSelector(tid('agent-state'));
  await shot(page, '47-agent-llm');

  // Wide: the tree is a column beside the session.
  await page.click(tid('agent-sheet-close'));
  await sleep(300);
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await sleep(1200);
  if (!(await page.$(tid('orchestrator-screen')))) await page.click(tid('room-orchestrator'));
  await page.waitForSelector(tid('orch-node-ses_cad'), { timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.includes('when it is clean'), { timeout: 20000 });
  await shot(page, '48-orchestrator-wide');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
