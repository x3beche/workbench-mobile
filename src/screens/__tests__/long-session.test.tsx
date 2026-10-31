/**
 * A long session on the phone: what a manager's Claude session looks like after days of work - hundreds of
 * turns, long answers, pictures, and the Workbench's notification rows between them - and what the screen pays
 * for while the newest answer grows (a poll a second, each bringing the whole conversation back).
 *
 * The numbers are logged (console.info) rather than asserted: a laptop's milliseconds are not a phone's, and a
 * hard budget here would fail on a busy machine. What is asserted is the work itself: a row that did not change
 * is not drawn again, and an answer's Markdown is parsed once per text.
 */
import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import type { BusEvent, WbcDetail, WbcTurn } from '../../api/types';
import type { WorkbenchClient } from '../../api/client';
import { BusPace, type LiveHub } from '../../live/hub';
import { LiveContext } from '../../live/LiveContext';
import { MARK } from '../../lib/wbc';
import { wbcStrings } from '../../lib/wbcStrings';
import * as markdown from '../../lib/markdown';
import * as notice from '../../lib/notice';
import { ClaudeSessionScreen } from '../ClaudeSessionScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('../../components/SwipeRow', () => ({ SwipeRow: (p: { children: React.ReactNode }) => p.children }));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));
jest.mock('../../lib/pictureFile', () => ({ readPictureHead: jest.fn(() => null) }));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const en = wbcStrings('en');
const NOW = Date.now() / 1000;
const TURNS = 500;

const ANSWER = [
  '## The rail, in three parts',
  '',
  'The sag is a **stiffness** problem before it is a load problem, so the fix is in the section - a box,',
  'not a plate - and in the two screws that carry it:',
  '',
  '1. The section: 2 mm walls, a 12 mm return, and a bead along the fold.',
  '2. The screws: M3 into a 4.5 mm boss, 6 mm deep, with a washer.',
  '3. The load path: the bead takes the bending, the screws take the peel.',
  '',
  '| part | before | after |',
  '| --- | --- | --- |',
  '| rail | 1.2 mm | 2.0 mm |',
  '| bead | none | 12 mm |',
  '| screws | 2 | 4 |',
  '',
  '```python',
  'def sag(length, e, i, load):',
  '    return (5 * load * length ** 4) / (384 * e * i)',
  '```',
  '',
  'With E = 70 GPa and I = 812 mm^4 the 300 mm rail drops from 0.42 mm to 0.11 mm under 40 N, which is',
  'inside the 0.2 mm the drawing allows.',
].join('\n');

/** 500 turns: an answer every other one, a notification row every fifty, a picture every hundred. */
function longSession(grown = 0): WbcTurn[] {
  const turns: WbcTurn[] = [];
  for (let i = 0; i < TURNS; i++) {
    const at = NOW - (TURNS - i) * 30;
    if (i % 2 === 0) {
      if (i % 50 === 0) {
        turns.push({
          id: `t${i}`,
          role: 'user',
          remote: true,
          at,
          text:
            `[Workbench] #${i}a AUDIT-SOMETHING-${i} - interrupted\n` +
            `#${i}b ANOTHER-TASK-${i} - answered: the rail is stiff enough now\n` +
            `#${i}c WAITING-TASK-${i} - waits for the person\n` +
            '(task_status <id> for the whole answer; task_close when it is done)',
        });
      } else {
        turns.push({
          id: `t${i}`,
          role: 'user',
          at,
          text: `And the picture of the rail at ${i}?`,
          images: i % 100 === 0 ? [{ req: `p${i}`, n: 0, type: 'image/png' }] : undefined,
        });
      }
    } else {
      // the newest answer is the one growing, a character at a time, as a stream arrives
      const tail = i === TURNS - 1 ? 'x'.repeat(grown) : '';
      turns.push({ id: `t${i}`, role: 'assistant', at, text: `${ANSWER}\n\n(after ${i} turns)${tail}` });
    }
  }
  return turns;
}

const detail = (): WbcDetail =>
  ({
    session_id: 's1',
    name: 'Rail sag',
    title: '',
    status: 'active',
    computer: 'ada-laptop',
    first_ts: NOW - 20_000,
    last_ts: NOW,
    prompts: 250,
    requests: 500,
    known: true,
    mine: true,
    owner: { id: 'u1', name: 'Ada' },
    bridge: {
      id: 'b1',
      connected: true,
      state: 'idle',
      detail: '',
      remote: true,
      host: 'ada-laptop',
      platform: 'linux',
      version: '0.3.0',
      cwd: '~/sensor',
      queue: 0,
      seen: NOW,
      started: NOW - 8000,
      images: true,
      outdated: false,
    },
    may_send: true,
    why: '',
    mark: MARK,
    messages: [],
  }) as unknown as WbcDetail;

function corpus() {
  // The conversation, made once: a poll sends it again, the newest answer one character longer. Building the
  // 500 turns per poll would put the test's own work in the measurement.
  const turns = longSession(0);
  /** How much the newest answer has grown: one more character for each poll. */
  let grown = 0;
  const c = {
    wbcSession: jest.fn(async () => ({ ...detail(), messages: [] })),
    wbcTurns: jest.fn(async () => {
      const last = turns[turns.length - 1];
      turns[turns.length - 1] = { ...last, text: `${last.text.slice(0, last.text.length - grown)}${'x'.repeat(grown)}` };
      return { turns: [...turns], more: false, before: null };
    }),
    liveKey: 'k',
    wbcTurnImagePath: (sid: string, req: string, n: number) => `/api/wbc/sessions/${sid}/images/${req}/${n}`,
    wbcMessageImagePath: (sid: string, mid: string, n: number) => `/api/wbc/sessions/${sid}/messages/${mid}/images/${n}`,
    wbcImage: jest.fn(async () => 'data:image/png;base64,AA=='),
    grow: () => {
      grown += 1;
    },
  };
  return c as unknown as WorkbenchClient & typeof c;
}

function fakeHub() {
  const subs: { kinds: string[]; fn: (e: BusEvent) => void }[] = [];
  const hub = {
    live: () => true,
    onLive: () => () => true,
    on: (kinds: string | string[], fn: (e: BusEvent) => void) => {
      const s = { kinds: Array.isArray(kinds) ? kinds : [kinds], fn };
      subs.push(s);
      return () => subs.splice(subs.indexOf(s), 1);
    },
    pace: (ms = 60_000) => new BusPace({ live: () => true }, ms),
    follow: () => ({ start() {}, stop() {}, pause() {}, resume() {}, live: () => false }),
    drop() {},
  };
  const say = (e: BusEvent) => {
    for (const s of [...subs]) if (e.k.startsWith('$') || s.kinds.includes(e.k)) s.fn(e);
  };
  return { hub: hub as unknown as LiveHub, say };
}

/** Milliseconds of CPU this process used: jest's fake timers fake the clock (and performance.now, hrtime), so a
 *  wall clock here would only say how much fake time was advanced. */
const ms = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};

const tick = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

(canRender ? describe : describe.skip)('a long Claude session', () => {
  it('does not draw the rows that did not change while the newest answer grows', async () => {
    const c = corpus();
    const { hub, say } = fakeHub();
    const parsed = jest.spyOn(markdown, 'parseMarkdown');
    // Every user turn drawn is a parseNotice call: a poll that draws them again shows up here.
    const noticed = jest.spyOn(notice, 'parseNotice');

    const t0 = ms();
    await render(
      <LiveContext.Provider value={hub}>
        <ClaudeSessionScreen sid="s1" client={c} user={{ id: 'u1', name: 'Ada', email: 'a@x' }} t={en} lang="en" />
      </LiveContext.Provider>,
    );
    await tick(0);
    const first = ms() - t0;
    const parsedFirst = parsed.mock.calls.length;

    // Ten polls, each bringing the conversation back one character longer: what a stream looks like.
    parsed.mockClear();
    noticed.mockClear();
    const t1 = ms();
    for (let i = 0; i < 10; i++) {
      c.grow();
      await act(async () => {
        say({ k: 'wbc', p: { sid: 's1', what: 'bridge' } } as unknown as BusEvent);
      });
      await tick(200);
    }
    const grew = ms() - t1;
    const parsesWhileGrowing = parsed.mock.calls.length;
    const noticesWhileGrowing = noticed.mock.calls.length;

    // And one poll that brings nothing new at all.
    noticed.mockClear();
    const t2 = ms();
    await act(async () => {
      say({ k: 'wbc', p: { sid: 's1', what: 'bridge' } } as unknown as BusEvent);
    });
    await tick(200);
    const idlePoll = ms() - t2;

    const heap = process.memoryUsage().heapUsed;
    console.info(
      `[long-session] ${TURNS} turns: first render ${first.toFixed(0)} ms (${parsedFirst} parses); ` +
        `10 growing polls ${grew.toFixed(0)} ms over ${c.wbcTurns.mock.calls.length} reads ` +
        `(${parsesWhileGrowing} parses, ${noticesWhileGrowing} row notices); ` +
        `one idle poll ${idlePoll.toFixed(0)} ms (${noticed.mock.calls.length} row notices); ` +
        `heap ${(heap / 1024 / 1024).toFixed(1)} MB`,
    );

    expect(screen.getByTestId('wbc-list')).toBeTruthy();
    // The rows that did not change are not drawn again: only the growing answer is new work.
    expect(parsesWhileGrowing).toBeLessThanOrEqual(10);
  });
});
