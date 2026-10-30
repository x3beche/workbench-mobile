/**
 * The home screen widget's refreshes: its ↻, its corner, the one door they all
 * go through, and the log that says what happened when Android held one back.
 *
 * The launcher is not here: `react-native-android-widget` is faked (a list of
 * the drawings it was asked for), the device's storage is the AsyncStorage mock,
 * and the server is a function.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WidgetSnapshot } from '../data';
import { LOG_MAX, readRefreshLog, writeRefreshLog } from '../log';
import { refreshWidget, draw } from '../refresh';
import { isStale, whenText, widest, REFRESH_TOUCH, StatsWidget } from '../StatsWidget';
import { settingsStrings } from '../../lib/settingsStrings';
import type { WidgetState } from '../StatsWidget';

/** What was asked of the launcher, in order: each drawing's state. */
const drawn: WidgetState[] = [];
jest.mock('react-native-android-widget', () => {
  const React = require('react');
  return {
    __esModule: true,
    // The widget's own primitives, as plain views: a drawing is only looked at here.
    FlexWidget: (p: any) => React.createElement('FlexWidget', p, p.children),
    TextWidget: (p: any) => React.createElement('TextWidget', p, p.text),
    SvgWidget: () => React.createElement('SvgWidget'),
    requestWidgetUpdate: jest.fn(async ({ renderWidget }: any) => {
      const el = renderWidget({ width: 362, height: 184 });
      drawn.push(el.props.state ?? {});
      return undefined;
    }),
  };
});

const snapAt = (at: number): WidgetSnapshot => ({
  at,
  models: { tokens: 1_200_000, calls: 900, days: [[1, 2]] },
  tools: { week: 40, month: 120, kinds: 5, on: 3, total: 9, days: [[1, 2, 3]] },
});

/** The server's answer, as `source.ts` would bring it back (a mock variable, so the factory may read it). */
let mockServer: jest.Mock;
jest.mock('../source', () => {
  // The device's storage, as `source.ts` uses it (the AsyncStorage mock's own module).
  const mod = require('@react-native-async-storage/async-storage');
  const store = mod.default ?? mod;
  return {
    fetchSnapshot: (...a: unknown[]) => mockServer(...a),
    readSnapshot: jest.fn(async () => {
      const raw = await store.getItem('workbench.widget.stats');
      return raw ? JSON.parse(raw) : null;
    }),
    saveSnapshot: jest.fn(async (s: unknown) => {
      await store.setItem('workbench.widget.stats', JSON.stringify(s));
    }),
  };
});

jest.mock('../words', () => ({
  widgetWords: async () => ({ t: require('../../lib/settingsStrings').settingsStrings('en'), lang: 'en' }),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  drawn.length = 0;
  jest.clearAllMocks();
  mockServer = jest.fn(async () => snapAt(1_000));
});

const t = settingsStrings('en');

describe('the refresh button', () => {
  it('draws "refreshing" first, then the reading it came back with', async () => {
    await AsyncStorage.setItem('workbench.widget.stats', JSON.stringify(snapAt(500)));
    const got = await refreshWidget('click', { showProgress: true });
    expect(got.outcome).toBe('ok');
    expect(mockServer).toHaveBeenCalledTimes(1);
    // The first drawing is the one it had, marked as being fetched; the second is the new reading.
    expect(drawn[0]).toEqual({ refreshing: true });
    expect(drawn[drawn.length - 1]).toEqual({});
    expect(JSON.parse((await AsyncStorage.getItem('workbench.widget.stats'))!).at).toBe(1_000);
  });

  it('keeps the reading it had when the server cannot be reached, and says so in the corner', async () => {
    await AsyncStorage.setItem('workbench.widget.stats', JSON.stringify(snapAt(500)));
    mockServer = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    const got = await refreshWidget('click', { showProgress: true });
    expect(got.outcome).toBe('error');
    expect(got.snap?.at).toBe(500);
    expect(drawn[0]).toEqual({ refreshing: true });
    expect(drawn[drawn.length - 1]).toEqual({ failed: true });
    const log = await readRefreshLog();
    expect(log[0]).toMatchObject({ trigger: 'click', outcome: 'error', note: 'Network request failed' });
  });

  it('is one request however often the button is pressed, and one at most every ten seconds', async () => {
    const slow = jest.fn(
      () => new Promise<WidgetSnapshot>((ok) => setTimeout(() => ok(snapAt(2_000)), 30)),
    );
    mockServer = slow;
    const [a, b, c] = await Promise.all([
      refreshWidget('click'),
      refreshWidget('click'),
      refreshWidget('click'),
    ]);
    expect(slow).toHaveBeenCalledTimes(1);
    expect([a.outcome, b.outcome, c.outcome].filter((x) => x === 'ok')).toHaveLength(1);
    expect([a.outcome, b.outcome, c.outcome].filter((x) => x === 'skipped')).toHaveLength(2);
    // Ten seconds later it may try again.
    const again = await refreshWidget('click');
    expect(again.outcome).toBe('skipped'); // still inside the ten seconds of the first
    const log = await readRefreshLog();
    expect(log.some((e) => e.outcome === 'skipped' && /already refreshing|not yet/.test(e.note ?? ''))).toBe(true);
  });

  it('lets the app ask every two minutes, and the chat every minute', async () => {
    expect((await refreshWidget('app')).outcome).toBe('ok');
    expect((await refreshWidget('app')).outcome).toBe('skipped');
    expect((await refreshWidget('chat')).outcome).toBe('ok');
    expect((await refreshWidget('chat')).outcome).toBe('skipped');
    // A launcher-driven update has no such rule: it is already rare.
    expect((await refreshWidget('update')).outcome).toBe('ok');
  });
});

describe('the corner', () => {
  const noon = new Date(2026, 9, 30, 14, 32).getTime();
  it('says the time today, "yesterday" yesterday, and the date before that', () => {
    expect(whenText(noon, t, 'en', noon + 60_000)).toBe('14:32');
    expect(whenText(noon, t, 'en', noon + 26 * 3600_000)).toBe('yesterday 14:32');
    expect(whenText(noon, t, 'en', noon + 6 * 86400_000)).toMatch(/^\d+ \w+ 14:32$/);
    expect(whenText(noon, settingsStrings('tr'), 'tr', noon + 26 * 3600_000)).toBe('dün 14:32');
    expect(whenText(0, t, 'en')).toBe('never');
  });

  it('is stale after two hours, and not before', () => {
    expect(isStale(noon, noon + 2 * 3600_000 - 1)).toBe(false);
    expect(isStale(noon, noon + 2 * 3600_000 + 1)).toBe(true);
    expect(isStale(0, noon)).toBe(true);
  });

  it('is drawn on the right half\'s head, with the ↻ in a box a finger can hit', () => {
    const el = StatsWidget({ snap: snapAt(noon), w: 362, h: 184, t, lang: 'en', state: {}, now: noon });
    expect(REFRESH_TOUCH).toBeGreaterThanOrEqual(40);
    // The card asks for the button's width when it sizes its head: a long state shrinks the words, not the figures.
    const plain = widest([{ title: 'Models', big: '1.2M', unit: 'tok', value: '900', word: 'calls' }]);
    const withCorner = widest([{ title: 'Models', big: '1.2M', unit: 'tok', value: '900', word: 'calls' }],
      { refresh: true, state: 'could not update' });
    expect(withCorner.head).toBeGreaterThan(plain.head + REFRESH_TOUCH);
    expect(el).toBeTruthy();
  });

  it('keeps OPEN_APP on the card itself: only the ↻ is a REFRESH', () => {
    // The widget is drawn from plain components with no hooks (a widget is a picture), so its tree can be
    // walked by calling each one the way the renderer would.
    const found: string[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      const el = typeof node.type === 'function' ? node.type(node.props) : node;
      if (el?.props?.clickAction) found.push(el.props.clickAction);
      const kids = el?.props?.children;
      (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(walk);
    };
    walk(StatsWidget({ snap: snapAt(1_000), w: 362, h: 184, t, lang: 'en', now: 1_000 }));
    expect(found.filter((x) => x === 'OPEN_APP')).toHaveLength(1);
    expect(found.filter((x) => x === 'REFRESH')).toHaveLength(1);
  });
});

describe('the log', () => {
  it('keeps the last twenty, newest first', async () => {
    for (let i = 0; i < LOG_MAX + 5; i++) {
      await writeRefreshLog({ at: 1_000 + i, trigger: 'update', outcome: 'ok' });
    }
    const rows = await readRefreshLog();
    expect(rows).toHaveLength(LOG_MAX);
    expect(rows[0].at).toBe(1_000 + LOG_MAX + 4);
    expect(rows[LOG_MAX - 1].at).toBe(1_000 + 5);
  });

  it('writes one line per attempt, not two: its outcome replaces "running"', async () => {
    await refreshWidget('update');
    const rows = await readRefreshLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ trigger: 'update', outcome: 'ok' });
  });

  it('says why an attempt was passed over', async () => {
    await refreshWidget('click');
    await refreshWidget('click');
    const rows = await readRefreshLog();
    expect(rows.some((e) => e.outcome === 'skipped' && /not yet/.test(e.note ?? ''))).toBe(true);
  });
});

describe('drawing', () => {
  it('draws the empty card when there is no reading at all', async () => {
    await draw(null);
    expect(drawn).toHaveLength(1);
  });
});
