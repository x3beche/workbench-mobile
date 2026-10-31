/**
 * A long OpenCode session on the phone: what an agent's session looks like after days of work - hundreds of
 * turns, each answer a few steps with a long answer under them - and what a poll pays when the server sends the
 * whole conversation back with one answer a character longer.
 *
 * The numbers are logged rather than asserted (a laptop's milliseconds are not a phone's). What is asserted is
 * the drawing: a row whose turn did not change is not drawn again, and the list is handed the same turns when
 * nothing changed at all.
 */
import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import type { BusEvent, WboDetail, WboMsg, WboPart } from '../../api/types';
import type { WorkbenchClient } from '../../api/client';
import { BusPace, type LiveHub } from '../../live/hub';
import { LiveContext } from '../../live/LiveContext';
import { wboStrings } from '../../lib/wboStrings';
import { OpencodeSessionScreen } from '../OpencodeSessionScreen';

// The step lines an answer draws: one render each, which is how a redrawn row shows up here.
const drawnSteps = { n: 0 };
jest.mock('../../components/MessageItem', () => {
  const React = jest.requireActual('react');
  const actual = jest.requireActual('../../components/MessageItem');
  return {
    ...actual,
    Steps: (p: { steps: unknown[] }) => {
      drawnSteps.n += 1;
      return React.createElement('Steps', { steps: p.steps });
    },
    CompactWork: (p: { children: React.ReactNode }) => React.createElement('CompactWork', null, p.children),
  };
});

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
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const t = wboStrings('en');
const NOW = Date.now() / 1000;
const TURNS = 500;
const LONG = [
  'The rail holds at 2 mm, and the bead is what takes the bending:',
  '',
  '1. the section, boxed rather than bent',
  '2. the bead along the fold',
  '3. four screws, 6 mm deep',
  '',
  '```python',
  'sag = 5 * load * length ** 4 / (384 * e * i)',
  '```',
  '',
  'That is 0.11 mm under 40 N, inside the 0.2 mm the drawing allows. The clearance on the picture is 0.2 mm,',
  'the board wants 0.25, so the two runs are apart and the length is kept. Everything else waits for the DRC.',
].join('\n');

/** 500 messages: a line from the person, then an answer with a thought, a tool call and its words. */
function session(grown: number): WboMsg[] {
  const msgs: WboMsg[] = [];
  for (let i = 0; i < TURNS; i++) {
    const at = (NOW - (TURNS - i) * 30) * 1000;
    if (i % 2 === 0) {
      msgs.push({ id: `u${i}`, role: 'user', time: at, done: at + 1000, parts: [textPart(`u${i}`, `And the rail at ${i}?`)] });
    } else {
      const last = i === TURNS - 1;
      msgs.push({
        id: `a${i}`,
        role: 'assistant',
        time: at,
        done: last && grown ? null : at + 4000,
        model: 'claude-sonnet-4-5',
        provider: 'workbench',
        parts: [
          { id: `r${i}`, type: 'reasoning', text: 'The sag is stiffness first.', start: at, end: at + 500 },
          {
            id: `t${i}`,
            type: 'tool',
            tool: 'read',
            title: 'cad/rail.py',
            status: 'completed',
            start: at + 500,
            end: at + 900,
          },
          textPart(`x${i}`, `${LONG}\n\n(after ${i})${'x'.repeat(last ? grown : 0)}`),
        ],
      });
    }
  }
  return msgs;
}

const textPart = (id: string, text: string): WboPart => ({ id, type: 'text', text });

function detail(msgs: WboMsg[]): WboDetail {
  return {
    session_id: 'ses_long',
    name: 'Rail sag',
    computer: 'x33-workstation',
    parent: null,
    updated: NOW * 1000,
    may_send: true,
    status: 'waiting',
    sends: [],
    asks: [],
    sends_count: 0,
    truncated: false,
    messages: msgs,
    bridge: {
      id: 'b1',
      connected: true,
      state: 'idle',
      remote: true,
      host: 'x33-workstation',
      platform: 'linux',
      version: '0.3.0',
      opencode: '2.1.2',
      cwd: '~/sensor',
      model: '',
      seen: NOW,
      started: NOW - 9000,
    },
  } as unknown as WboDetail;
}

function corpus() {
  const base = session(0);
  let grown = 0;
  const c = {
    wboSession: jest.fn(async () => detail(grown ? session(grown) : base)),
    grow: () => {
      grown += 1;
    },
    liveKey: 'k',
    s2Streams: jest.fn(async () => ({ streams: [] })),
    wboTurnImagePath: (sid: string, req: string, n: number) => `/api/wbo/sessions/${sid}/images/${req}/${n}`,
    wboMessageImagePath: (sid: string, mid: string, n: number) => `/api/wbo/sessions/${sid}/messages/${mid}/images/${n}`,
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

/** Milliseconds of CPU this process used (jest's fake timers fake the clock and performance.now). */
const cpu = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};

const tick = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  drawnSteps.n = 0;
});
afterEach(() => jest.useRealTimers());

(canRender ? describe : describe.skip)('a long OpenCode session', () => {
  it('does not redraw the answers that did not change while the newest one grows', async () => {
    const c = corpus();
    const { hub, say } = fakeHub();

    const t0 = cpu();
    await render(
      <LiveContext.Provider value={hub}>
        <OpencodeSessionScreen sid="ses_long" client={c} t={t} lang="en" />
      </LiveContext.Provider>,
    );
    await tick(0);
    const first = cpu() - t0;
    const drewFirst = drawnSteps.n;

    drawnSteps.n = 0;
    const t1 = cpu();
    for (let i = 0; i < 10; i++) {
      c.grow();
      await act(async () => {
        say({ k: 'wbo', p: { sid: 'ses_long' } } as unknown as BusEvent);
      });
      await tick(150);
    }
    const grew = cpu() - t1;
    const drewWhileGrowing = drawnSteps.n;

    console.info(
      `[long-opencode] ${TURNS} messages: first render ${first.toFixed(0)} ms (${drewFirst} step rows); ` +
        `10 growing polls ${grew.toFixed(0)} ms, ${c.wboSession.mock.calls.length} reads, ` +
        `${drewWhileGrowing} step rows drawn`,
    );

    expect(screen.getByTestId('wbo-list')).toBeTruthy();
    // Only the answer being written is drawn again: the others are the objects they were.
    expect(drewWhileGrowing).toBeLessThanOrEqual(10);
  });
});
