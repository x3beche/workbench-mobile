/**
 * The screens on the account's bus (1.5.9): a room is read again when a line
 * is said in it, the Agent & LLM sheet when the Orchestrator changed; their
 * timers rest while the bus is up and poll as before while it is down.
 */
import * as React from 'react';
import { act, render } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { BusEvent } from '../../api/types';
import { AgentSheet } from '../../components/AgentSheet';
import { orchStrings } from '../../lib/orchStrings';
import { BusPace, type LiveHub } from '../../live/hub';
import { LiveContext } from '../../live/LiveContext';
import { RoomScreen } from '../RoomScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));

const canRender = typeof (React as { act?: unknown }).act === 'function';

/** A hub that is up (or down) by the test's word, and lets it say bus events. */
function fakeHub(up: boolean) {
  const subs: { kinds: string[]; fn: (e: BusEvent) => void }[] = [];
  const hub = {
    live: () => up,
    onLive: () => () => true,
    on: (kinds: string | string[], fn: (e: BusEvent) => void) => {
      const s = { kinds: Array.isArray(kinds) ? kinds : [kinds], fn };
      subs.push(s);
      return () => subs.splice(subs.indexOf(s), 1);
    },
    pace: (ms = 60_000) => new BusPace({ live: () => up }, ms),
    follow: () => ({ start() {}, stop() {}, pause() {}, resume() {}, live: () => false }),
    drop() {},
  };
  const say = (e: BusEvent) => {
    for (const s of [...subs]) if (e.k.startsWith('$') || s.kinds.includes(e.k)) s.fn(e);
  };
  return { hub: hub as unknown as LiveHub, say };
}

const tick = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

(canRender ? describe : describe.skip)('a room on the bus', () => {
  const roomClient = () =>
    ({ roomHistory: jest.fn(async () => []), sayRoom: jest.fn() }) as unknown as WorkbenchClient & {
      roomHistory: jest.Mock;
    };

  it('is read again when a line is said in it, not every two seconds', async () => {
    const c = roomClient();
    const { hub, say } = fakeHub(true);
    await render(
      <LiveContext.Provider value={hub}>
        <RoomScreen room="pcb" client={c} server="s" user={null} lang="en" />
      </LiveContext.Provider>,
    );
    await tick(0);
    const first = c.roomHistory.mock.calls.length;
    await tick(2000); // the first tick reads once (the safety net starts)
    const rested = c.roomHistory.mock.calls.length;
    await tick(10_000);
    expect(c.roomHistory.mock.calls.length).toBe(rested);
    say({ k: 'line', p: { room: 'cad', what: 'line' } }); // another room
    await tick(100);
    expect(c.roomHistory.mock.calls.length).toBe(rested);
    say({ k: 'line', p: { room: 'pcb', what: 'line' } });
    say({ k: 'line', p: { room: 'pcb', what: 'seen' } }); // a burst: read once
    await tick(100);
    expect(c.roomHistory.mock.calls.length).toBe(rested + 1);
    expect(first).toBeGreaterThan(0);
  });

  it('polls every two seconds while the bus is down', async () => {
    const c = roomClient();
    const { hub } = fakeHub(false);
    await render(
      <LiveContext.Provider value={hub}>
        <RoomScreen room="pcb" client={c} server="s" user={null} lang="en" />
      </LiveContext.Provider>,
    );
    await tick(0);
    const first = c.roomHistory.mock.calls.length;
    await tick(6000);
    expect(c.roomHistory.mock.calls.length).toBe(first + 3);
  });

  it('polls as before without a hub (a test, an older app shell)', async () => {
    const c = roomClient();
    await render(<RoomScreen room="pcb" client={c} server="s" user={null} lang="en" />);
    await tick(0);
    const first = c.roomHistory.mock.calls.length;
    await tick(4000);
    expect(c.roomHistory.mock.calls.length).toBe(first + 2);
  });
});

(canRender ? describe : describe.skip)('Agent & LLM on the bus', () => {
  const status = {
    state: 'running',
    desired: 'running',
    since: null,
    model: 'a/b',
    halted: null,
    crash_loop: false,
    providers: [{ id: 'openrouter', name: 'OpenRouter', models: ['a/b'] }],
    choice: { provider_id: 'openrouter', model: 'a/b' },
  };

  it('reads its state when the Orchestrator changed, and rests the 5 s look', async () => {
    const c = { orchestrator: jest.fn(async () => status) } as unknown as WorkbenchClient & { orchestrator: jest.Mock };
    const { hub, say } = fakeHub(true);
    await render(
      <LiveContext.Provider value={hub}>
        <AgentSheet client={c} t={orchStrings('en')} lang="en" onClose={() => undefined} />
      </LiveContext.Provider>,
    );
    await tick(5000);
    const rested = c.orchestrator.mock.calls.length;
    await tick(20_000);
    expect(c.orchestrator.mock.calls.length).toBe(rested);
    say({ k: 'orch' });
    await tick(0);
    expect(c.orchestrator.mock.calls.length).toBe(rested + 1);
  });
});
