/**
 * A Claude session on the phone: its turns ten at a time, the note in place
 * of the box when it cannot be written to, the box and what became of a line
 * when it can, read again when the bus tells of it - and its group in the drawer.
 */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { BusEvent, WbcDetail, WbcMessage, WbcSession, WbcTurn } from '../../api/types';
import { DrawerPanel } from '../../components/DrawerPanel';
import { BusPace, type LiveHub } from '../../live/hub';
import { LiveContext } from '../../live/LiveContext';
import { MARK } from '../../lib/wbc';
import { wbcStrings } from '../../lib/wbcStrings';
import { ClaudeSessionScreen } from '../ClaudeSessionScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('../../components/SwipeRow', () => ({
  SwipeRow: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [
      { uri: 'file:///shot.png', fileName: 'shot.png', mimeType: 'image/png', fileSize: 2000 },
      { uri: 'file:///clip.mov', fileName: 'clip.heic', mimeType: 'image/heic', fileSize: 2000 },
    ],
  })),
}));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const en = wbcStrings('en');
const NOW = Date.now() / 1000;

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

const row = (over: Partial<WbcSession> = {}): WbcSession => ({
  session_id: 's1',
  name: 'Rail sag',
  title: '',
  status: 'active',
  computer: 'ada-laptop',
  first_ts: NOW - 4000,
  last_ts: NOW - 60,
  prompts: 2,
  requests: 8,
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
    version: '0.2.1',
    cwd: '~/sensor',
    queue: 0,
    seen: NOW,
    started: NOW - 3600,
    images: true,
    outdated: false,
  },
  may_send: true,
  why: '',
  ...over,
});

const TURNS: WbcTurn[] = [
  { id: 'r1', role: 'user', text: 'Why does the rail sag?', at: NOW - 600 },
  { id: 'r1', role: 'assistant', text: 'Because of **FB2**.', at: NOW - 590, model: 'claude-sonnet-4-5' },
  { id: 'r2', role: 'user', text: `${MARK} Run the DRC`, at: NOW - 300, remote: true },
];

function client(detail: Partial<WbcDetail> = {}) {
  const d: WbcDetail = { ...row(), messages: [], mark: MARK, ...detail };
  return {
    wbcSession: jest.fn(async () => ({ ...d, messages: [...d.messages] })),
    wbcTurns: jest.fn(async (_sid: string, _limit: number, before?: number | null) =>
      before ? { turns: [], more: false, before: null } : { turns: TURNS, more: true, before: NOW - 600 },
    ),
    wbcSend: jest.fn(async () => sent(d)),
    wbcTurnImagePath: (sid: string, req: string, n: number) => `/api/wbc/sessions/${sid}/images/${req}/${n}`,
    wbcMessageImagePath: (sid: string, mid: string, n: number) =>
      `/api/wbc/sessions/${sid}/messages/${mid}/images/${n}`,
    wbcImage: jest.fn(async () => 'data:image/png;base64,AA=='),
    liveKey: 'k',
  } as unknown as WorkbenchClient & { wbcSession: jest.Mock; wbcTurns: jest.Mock; wbcSend: jest.Mock };
}

/** The line the server keeps: in the session's messages from then on. */
function sent(d: WbcDetail): WbcMessage {
  const m: WbcMessage = {
    id: 'm1',
    text: 'and the linter',
    by: { id: 'u1', name: 'Ada' },
    status: 'queued',
    detail: '',
    error: '',
    at: NOW,
    updated: NOW,
    delivered_at: null,
  };
  d.messages.push({ ...m });
  return m;
}

const tick = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function open(c: ReturnType<typeof client>, hub: LiveHub | null = null) {
  await render(
    <LiveContext.Provider value={hub}>
      <ClaudeSessionScreen sid="s1" client={c} user={{ id: 'u1', name: 'Ada', email: 'a@x' }} t={en} lang="en" />
    </LiveContext.Provider>,
  );
  await tick(0);
}

(canRender ? describe : describe.skip)('a Claude session', () => {
  it('opens at its newest turns, ten at a time, with the remote mark', async () => {
    const c = client();
    await open(c);
    expect(c.wbcTurns).toHaveBeenCalledWith('s1', 10);
    expect(screen.getByText('Why does the rail sag?')).toBeTruthy();
    expect(screen.getByText('Run the DRC')).toBeTruthy();
    expect(screen.getByText('from Workbench')).toBeTruthy();
    expect(screen.getByText('at the prompt')).toBeTruthy();
    expect(screen.getByTestId('wbc-composer')).toBeTruthy();
  });

  it("offers Claude Code's suggestion in the empty box, and Use puts it in", async () => {
    const c = client();
    c.wbcTurns.mockImplementation(async () => ({ turns: TURNS, more: false, before: null, suggestion: 'Run the linter too' }));
    await open(c);
    expect(screen.getByTestId('composer-input').props.placeholder).toBe('Run the linter too');
    await fireEvent.press(screen.getByTestId('composer-use-suggestion'));
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('Run the linter too');
    await fireEvent.press(screen.getByTestId('send'));
    await tick(0);
    expect(c.wbcSend).toHaveBeenCalledWith('s1', 'Run the linter too', []);
    expect(screen.getByTestId('composer-input').props.placeholder).toBe(en.placeholder);
  });

  it('is a note saying why when it cannot be written to', async () => {
    const c = client({ may_send: false, why: 'no-bridge', bridge: null, status: 'ended' });
    await open(c);
    expect(screen.queryByTestId('wbc-composer')).toBeNull();
    expect(screen.getByTestId('wbc-why')).toBeTruthy();
    expect(screen.getByText(en.why.noBridge)).toBeTruthy();
  });

  it('sends a line and shows what became of it', async () => {
    const c = client();
    await open(c);
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'and the linter');
    await fireEvent.press(screen.getByTestId('send'));
    await tick(0);
    expect(c.wbcSend).toHaveBeenCalledWith('s1', 'and the linter', []);
    expect(screen.getByText('sent — waiting for the computer')).toBeTruthy();
  });

  it('takes pictures from the photos, leaving out a type it cannot send', async () => {
    const c = client();
    await open(c);
    await fireEvent.press(screen.getByTestId('wbc-attach'));
    await fireEvent.press(screen.getByTestId('action-wbc-photos'));
    await tick(0);
    expect(screen.getByTestId('wbc-unpick-0')).toBeTruthy();
    expect(screen.queryByTestId('wbc-unpick-1')).toBeNull();
    expect(screen.getByText(en.onlyTypes)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('send'));
    await tick(0);
    expect(c.wbcSend).toHaveBeenCalledWith('s1', '', [
      { uri: 'file:///shot.png', name: 'shot.png', type: 'image/png' },
    ]);
  });

  it('says to update wb-claude before pictures go to an old one', async () => {
    const c = client();
    const r = row();
    c.wbcSession.mockResolvedValue({
      ...r,
      bridge: { ...r.bridge!, images: false, outdated: true },
      messages: [],
      mark: MARK,
    });
    await open(c);
    expect(screen.getByText('update wb-claude')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wbc-attach'));
    expect(screen.getByText(en.updateForPictures)).toBeTruthy();
    expect(screen.queryByTestId('wbc-pick')).toBeNull();
  });

  it('is read again when the bus tells of it, its turns too when the bridge changed', async () => {
    const c = client();
    const { hub, say } = fakeHub(true);
    await open(c, hub);
    const reads = c.wbcSession.mock.calls.length;
    const pages = c.wbcTurns.mock.calls.length;
    say({ k: 'wbc', p: { sid: 'other', what: 'message' } });
    await tick(200);
    expect(c.wbcSession.mock.calls.length).toBe(reads);
    say({ k: 'wbc', p: { sid: 's1', what: 'message' } });
    await tick(200);
    expect(c.wbcSession.mock.calls.length).toBe(reads + 1);
    expect(c.wbcTurns.mock.calls.length).toBe(pages);
    say({ k: 'wbc', p: { sid: 's1', what: 'bridge' } });
    await tick(200);
    expect(c.wbcTurns.mock.calls.length).toBe(pages + 1);
  });

  it('polls while active when the bus is down, and rests while it is up', async () => {
    const c = client();
    await open(c, fakeHub(false).hub);
    const first = c.wbcTurns.mock.calls.length;
    await tick(5000);
    await tick(5000);
    expect(c.wbcTurns.mock.calls.length).toBe(first + 2);

    const d = client();
    await open(d, fakeHub(true).hub);
    const up = d.wbcTurns.mock.calls.length;
    await tick(5000); // the safety net's first read
    const rested = d.wbcTurns.mock.calls.length;
    await tick(20_000);
    expect(d.wbcTurns.mock.calls.length).toBe(rested);
    expect(rested - up).toBeLessThanOrEqual(1);
  });
});

(canRender ? describe : describe.skip)('Claude sessions in the drawer', () => {
  it('lists them with their state and computer, and opens one', async () => {
    const onWbc = jest.fn();
    await render(
      <DrawerPanel
        client={null}
        server="https://wb.example"
        user={null}
        chats={[]}
        error={null}
        openId={null}
        onOpen={jest.fn()}
        onNew={jest.fn()}
        onRefresh={jest.fn(async () => undefined)}
        onActions={jest.fn()}
        onAccount={jest.fn()}
        wbc={{
          t: en,
          rows: [
            row(),
            row({ session_id: 's2', name: 'OTA', bridge: null, status: 'ended', last_ts: NOW - 3600, computer: 'ws' }),
            row({ session_id: 's3', name: 'Old one', bridge: null, status: 'ended', last_ts: NOW - 5 * 86400 }),
          ],
        }}
        onWbc={onWbc}
      />,
    );
    expect(screen.getByText('Claude sessions · 2')).toBeTruthy();
    expect(screen.getByText('at the prompt · ada-laptop')).toBeTruthy();
    expect(screen.getByText('ended · ws')).toBeTruthy();
    expect(screen.queryByText('Old one')).toBeNull();
    expect(screen.getByTestId('wbc-dot-s1')).toBeTruthy();
    expect(screen.queryByTestId('wbc-dot-s2')).toBeNull();
    await fireEvent.press(screen.getByTestId('wbc-s2'));
    expect(onWbc).toHaveBeenCalledWith('s2');
  });
});
