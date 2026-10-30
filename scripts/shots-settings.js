/**
 * Settings, Analytics and the Claude pool (1.9.9), against the made-up server.
 * Settings is a menu now - ACCOUNT, AI, APPEARANCE, VOICE, APP - with a page
 * behind every row that has something to choose (accounts, how much the Chat
 * shows, the themes, the app's language, the voice's, the widget, About), so
 * the shots walk into those pages and back. Analytics from the drawer (models,
 * spend, tools, Orchestrator, job pool, sandboxes), the app in Turkish, and a
 * light theme and a wide screen. Run by scripts/shots.sh with SHOTS=settings.
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

/**
 * Type into a field that may come back filled from last time (the app remembers
 * the email it signed in with). The browser's own value is emptied through the
 * setter React watches, so what is typed is the whole value and not an addition.
 */
async function typeInto(page, testID, text) {
  await sleep(600);
  await page.$eval(tid(testID), (el) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(200);
  await page.click(tid(testID));
  await page.type(tid(testID), text);
  const got = await page.$eval(tid(testID), (e) => e.value ?? '');
  if (got !== text) console.log(`WARN ${testID} says "${got}", wanted "${text}"`);
}

async function scrollTo(page, testID) {
  await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.scrollIntoView({ block: 'start' }), testID);
  await sleep(300);
}

/** The radio of a page whose words begin with `label`. */
async function pick(page, pageTestID, label) {
  const radios = await page.$$(`${tid(pageTestID)} [role="radio"]`);
  for (const r of radios) {
    const words = await r.evaluate((e) => e.innerText || '');
    if (words.trim().startsWith(label)) {
      await r.click();
      return true;
    }
  }
  console.log('WARN no radio', label, 'on', pageTestID);
  return false;
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
  // A made-up server that has not been signed in on yet (a fresh proxy) asks who
  // it is talking to: the person the mock has, with the password it accepts.
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="new-chat-screen"],[data-testid="login-submit"]'),
    { timeout: 20000 },
  );
  if (await page.$(tid('login-submit'))) {
    await page.type(tid('login-email'), 'ada@example.com');
    await page.type(tid('login-password'), 'mock');
    await page.click(tid('login-submit'));
  }
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 20000 });

  // Analytics.
  // The screen the app came back to opens the drawer with a button of its own.
  await page.click('[data-testid="open-drawer"],[data-testid$="-open-drawer"]');
  await page.waitForSelector(tid('open-analytics'));
  await sleep(400);
  await shot(page, '70-drawer-analytics');
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '71-analytics');
  await scrollTo(page, 'analytics-tools');
  await shot(page, '72-analytics-tools');
  // Opened: the week by source and the most used tool; then Claude Code's and OpenCode's own tools.
  await page.click(tid('analytics-tools'));
  await sleep(300);
  await shot(page, '72b-analytics-tools-split');
  await page.click(tid('analytics-tools'));
  await scrollTo(page, 'analytics-tools-claude');
  await shot(page, '72c-analytics-tools-claude-opencode');
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

  // Settings (1.9.9): the menu, from the account at the foot of the drawer.
  await page.click(tid('analytics-open-drawer'));
  await sleep(400);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('settings-screen'));
  await shot(page, '75-settings');
  // The rest of the menu: appearance, voice, app, and the one red row at its foot.
  await scrollTo(page, 'settings-group-app');
  await shot(page, '75b-settings-menu');
  // Signing out is the one dangerous row, and it asks before it does it.
  await scrollTo(page, 'action-sign-out');
  await page.click(tid('action-sign-out'));
  await page.waitForFunction(() => document.body.innerText.includes('Sign out of Workbench?'), { timeout: 5000 });
  await shot(page, '75c-settings-signout');
  await page.click(tid('dialog-cancel'));
  await sleep(400);

  // Accounts: the open one marked "Active", the way out in the row's "..." menu.
  await scrollTo(page, 'settings-row-accounts');
  await page.click(tid('settings-row-accounts'));
  await page.waitForSelector(tid('settings-accounts-page'));
  await shot(page, '75d-settings-accounts');
  const ways = await page.$('[data-testid^="account-remove-"]');
  if (ways) {
    await ways.click();
    await page.waitForSelector(tid('account-menu'));
    await shot(page, '75f-settings-account-menu');
    await page.click(tid('action-sign-out'));
    await page.waitForFunction(() => document.body.innerText.includes('Sign out of'), { timeout: 5000 });
    await page.click(tid('dialog-cancel'));
    await sleep(300);
  }

  // A second account on the same server (1.9.11): added from this page, signed in
  // the way a second one is, so the switcher has two and tapping one moves "Active".
  await page.click(tid('account-add'));
  await page.waitForSelector(tid('server-connect'), { timeout: 20000 });
  await page.click(tid('server-connect'));
  await page.waitForSelector(tid('login-email'), { timeout: 20000 });
  // The field comes back filled with the account of before: it is replaced, not added to.
  await typeInto(page, 'login-email', 'bora.kaya@example.com');
  await typeInto(page, 'login-password', 'mock');
  await page.click(tid('login-submit'));
  await page.waitForSelector(tid('new-chat-screen'), { timeout: 30000 });
  console.log('second account added');
  // Two of them: the open one "Active" in small quiet type, the other's "..." there too.
  await page.click('[data-testid="open-drawer"],[data-testid$="-open-drawer"]');
  await sleep(600);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('settings-screen'));
  await scrollTo(page, 'settings-row-accounts');
  await page.click(tid('settings-row-accounts'));
  await page.waitForSelector(tid('settings-accounts-page'));
  await shot(page, '75g-settings-accounts-two');
  // The second account's own "..." - where signing one of two out lives.
  const others = await page.$$('[data-testid^="account-remove-"]');
  if (others.length > 1) {
    await others[others.length - 1].click();
    await page.waitForSelector(tid('account-menu'));
    await shot(page, '75h-settings-account-menu-second');
    // Out of the menu again: the dimmed ground above it closes it.
    await page.mouse.click(195, 120);
    await sleep(400);
  }
  // Tapping the account that is not open moves "Active" to it, on the page itself.
  // The word in the row is the mark: the open one wears it, the other does not.
  const closed = await page.evaluateHandle(() =>
    [...document.querySelectorAll('[data-testid="settings-accounts-page"] [role="radio"]')].find(
      (e) => !/ACTIVE|AKTİF/.test(e.innerText || ''),
    ),
  );
  const row = closed.asElement();
  if (row) {
    await row.click();
    await sleep(1500);
    // Tapping opens the other account, and the app goes back to it: the page is
    // opened again to show that the word moved with the account.
    if (!(await page.$(tid('settings-accounts-page')))) {
      await page.waitForSelector('[data-testid="open-drawer"],[data-testid$="-open-drawer"]', { timeout: 30000 });
      await page.evaluate(() =>
        document.querySelector('[data-testid="open-drawer"],[data-testid$="-open-drawer"]')?.click(),
      );
      await sleep(700);
      await page.click(tid('open-account'));
      await page.waitForSelector(tid('settings-screen'));
      await scrollTo(page, 'settings-row-accounts');
      await page.click(tid('settings-row-accounts'));
      await page.waitForSelector(tid('settings-accounts-page'));
      await sleep(500);
    }
    await shot(page, '75i-settings-accounts-switched');
  } else {
    console.log('WARN no closed account row to tap');
  }
  await page.click(tid('settings-back'));
  // And the foot of the menu now names the account it would sign out.
  await scrollTo(page, 'action-sign-out');
  await shot(page, '75j-settings-signout-named');

  // How much of an answer the Chat shows.
  await scrollTo(page, 'settings-row-chat');
  await page.click(tid('settings-row-chat'));
  await page.waitForSelector(tid('settings-chat-detail'));
  await shot(page, '75e-settings-chat-detail');
  await page.click(tid('settings-back'));

  // The Claude pool (1.6.2): the windows, the week's ring and its people, My sessions.
  await scrollTo(page, 'action-ccpool');
  await page.click(tid('settings-row-ccpool'));
  await page.waitForSelector(tid('ccpool-ring'), { timeout: 10000 });
  await shot(page, '74b-ccpool');
  await scrollTo(page, 'ccpool-mine');
  await shot(page, '74c-ccpool-sessions');
  await page.click(tid('ccpool-back'));
  await page.waitForSelector(tid('settings-screen'));

  // The themes, in a page of their own.
  await scrollTo(page, 'settings-row-theme');
  await page.click(tid('settings-row-theme'));
  await page.waitForSelector(tid('settings-theme-page'));
  await shot(page, '76-settings-themes');
  await page.click(tid('settings-back'));

  // The home screen widget (1.9.11): the card as the launcher draws it, the line that
  // says whether it is there, and how to add it. The web build has no launcher, so the
  // Android-only "Add to home screen" button is proved by a test, not by this picture.
  await scrollTo(page, 'settings-row-widget');
  await page.click(tid('settings-row-widget'));
  await page.waitForSelector(tid('settings-widget-page'));
  await page.waitForSelector(tid('widget-preview'));
  await page.evaluate(() => document.querySelector('[data-testid="widget-preview"]')?.scrollIntoView({ block: 'center' }));
  await shot(page, '76d-settings-widget');
  await page.click(tid('settings-back'));

  // About: the version, its update, the licence and the source, on one page.
  await scrollTo(page, 'settings-row-about');
  await page.click(tid('settings-row-about'));
  await page.waitForSelector(tid('settings-about-page'));
  await shot(page, '76e-settings-about');
  await page.click(tid('settings-back'));

  // The app's language, in a page of its own.
  await scrollTo(page, 'settings-row-language');
  await page.click(tid('settings-row-language'));
  await page.waitForSelector(tid('settings-language'));
  await shot(page, '76b-settings-language');

  // Türkçe, chosen there: the app's words change at once, the page's own title too.
  await pick(page, 'settings-language', 'Türkçe');
  await page.waitForFunction(() => document.body.innerText.includes('Dil'), { timeout: 5000 });
  await shot(page, '76c-settings-language-tr');
  await page.click(tid('settings-back'));
  await page.waitForFunction(() => document.body.innerText.includes('Ayarlar'), { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[data-testid="settings-screen"] [role="header"]')?.scrollIntoView());
  await shot(page, '77-settings-tr');
  // The widget and About in Turkish: the two pages that are mostly words.
  await scrollTo(page, 'settings-row-widget');
  await page.click(tid('settings-row-widget'));
  await page.waitForSelector(tid('widget-preview'));
  await page.evaluate(() => document.querySelector('[data-testid="widget-preview"]')?.scrollIntoView({ block: 'center' }));
  await shot(page, '77f-settings-widget-tr');
  await page.click(tid('settings-back'));
  await scrollTo(page, 'settings-row-about');
  await page.click(tid('settings-row-about'));
  await page.waitForSelector(tid('settings-about-page'));
  await shot(page, '77g-settings-about-tr');
  await page.click(tid('settings-back'));

  // The voice's language, in Turkish too.
  await scrollTo(page, 'settings-row-voice-lang');
  await page.click(tid('settings-row-voice-lang'));
  await page.waitForSelector(tid('settings-voice-lang'));
  await shot(page, '77c-settings-voice-tr');
  await page.click(tid('settings-back'));

  // Not only the settings around an English middle: the drawer and a conversation too.
  await page.click(tid('settings-open-drawer'));
  await sleep(500);
  await shot(page, '77d-drawer-tr');
  const turkish = await page.$(tid('chat-c1'));
  if (turkish) {
    await turkish.click();
    await sleep(900);
    await shot(page, '77e-chat-tr');
    await page.click('[data-testid="open-drawer"],[data-testid$="-open-drawer"]');
    await sleep(400);
    await page.click(tid('open-account'));
    await page.waitForSelector(tid('settings-screen'));
  }
  await scrollTo(page, 'action-ccpool');
  await page.click(tid('settings-row-ccpool'));
  await page.waitForSelector(tid('ccpool-ring'), { timeout: 10000 });
  await shot(page, '77b-ccpool-tr');
  await page.click(tid('ccpool-back'));
  await page.waitForSelector(tid('settings-screen'));
  await page.click(tid('settings-open-drawer'));
  await sleep(300);
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '78-analytics-tr');

  // Back to English for the looks that follow.
  await page.click(tid('analytics-open-drawer'));
  await sleep(400);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('settings-screen'));
  await scrollTo(page, 'settings-row-language');
  await page.click(tid('settings-row-language'));
  await page.waitForSelector(tid('settings-language'));
  await pick(page, 'settings-language', 'English');
  await page.waitForFunction(() => document.body.innerText.includes('Language'), { timeout: 5000 });
  await page.click(tid('settings-back'));

  // A light theme: the choice is read when the app starts.
  await page.evaluate(() => localStorage.setItem('wb.theme', 'github-light'));
  await page.reload({ waitUntil: 'domcontentloaded' }); // live reads stay open: the network is never idle
  // The app comes back to the conversation that was open, or to a new one.
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="new-chat-screen"],[data-testid="chat-screen"]'),
    { timeout: 20000 },
  );
  // The screen the app came back to opens the drawer with a button of its own.
  await page.click('[data-testid="open-drawer"],[data-testid$="-open-drawer"]');
  await sleep(300);
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '79-analytics-light');
  // Settings in the light theme, menu and theme page alike.
  await page.click(tid('analytics-open-drawer'));
  await sleep(400);
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('settings-screen'));
  await shot(page, '79b-settings-light');
  await scrollTo(page, 'settings-row-theme');
  await page.click(tid('settings-row-theme'));
  await page.waitForSelector(tid('settings-theme-page'));
  await shot(page, '79c-settings-themes-light');
  await page.click(tid('settings-back'));
  // The widget and About in the light theme as well: the card's own plate on white.
  await scrollTo(page, 'settings-row-widget');
  await page.click(tid('settings-row-widget'));
  await page.waitForSelector(tid('widget-preview'));
  await page.evaluate(() => document.querySelector('[data-testid="widget-preview"]')?.scrollIntoView({ block: 'center' }));
  await shot(page, '79d-settings-widget-light');
  await page.click(tid('settings-back'));
  await scrollTo(page, 'settings-row-about');
  await page.click(tid('settings-row-about'));
  await page.waitForSelector(tid('settings-about-page'));
  await shot(page, '79e-settings-about-light');
  await page.click(tid('settings-back'));

  // Wide: the same column, centred, and two cards a row in Analytics.
  await page.evaluate(() => localStorage.setItem('wb.theme', 'spartan-dark'));
  await page.reload({ waitUntil: 'domcontentloaded' }); // live reads stay open: the network is never idle
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
  await page.waitForSelector(tid('open-analytics'), { timeout: 20000 });
  await page.click(tid('open-analytics'));
  await page.waitForSelector(tid('analytics-models'), { timeout: 15000 });
  await shot(page, '80-analytics-wide');
  // The menu on a wide screen: the same column, centred, the drawer's account opening it.
  await page.click(tid('open-account'));
  await page.waitForSelector(tid('settings-screen'));
  await shot(page, '80b-settings-wide');
  // A page under it on a wide screen: the same centred column, the bar's title lined up with it.
  await page.click(tid('settings-row-theme'));
  await page.waitForSelector(tid('settings-theme-page'));
  await shot(page, '80c-settings-wide-page');
  console.log('S2 reads', JSON.stringify(s2.reads), '| token in an address or no header:', s2.bad);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
