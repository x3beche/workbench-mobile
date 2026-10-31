/**
 * A session's column on the phone (components/SessionPanelSheet.tsx, lib/wboPanel.ts): the "i" beside the
 * session's title opens what the web's right-hand column shows - the model and its window, what the run is
 * doing now, the files it changed, and the computer in one dim line at the foot - and the rules of that column:
 * a section with nothing in it is not drawn, a section folds as the person folded it (kept on the server), a
 * question is one line at the top that goes to its card in the conversation (where it is answered), and nothing
 * the sheet says is said again in the screen's header.
 */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { WboDetail, WboPanel } from '../../api/types';
import { LiveContext } from '../../live/LiveContext';
import type { LiveHub } from '../../live/hub';
import { SIDE_EMPTY } from '../../lib/side';
import { wboStrings } from '../../lib/wboStrings';
import { OpencodeSessionScreen } from '../OpencodeSessionScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('../../components/SwipeRow', () => ({
  SwipeRow: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../lib/pictureFile', () => ({ readPictureHead: jest.fn(() => null) }));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const t = wboStrings('en');
const NOW = Date.now();
const SID = 'ses_column0001';

const hub = {
  live: () => false,
  onLive: () => () => true,
  on: () => () => undefined,
  pace: (ms = 60_000) => ({ due: () => true, mark: () => undefined, ms }),
  follow: () => ({ start() {}, stop() {}, pause() {}, resume() {}, live: () => false }),
  drop() {},
} as unknown as LiveHub;

const detail = (): WboDetail =>
  ({
    session_id: SID,
    title: 'Rail sag',
    name: 'Rail sag',
    status: 'idle',
    directory: '~/sensor',
    computer: 'ada-laptop',
    updated: NOW,
    seen: null,
    created: null,
    parent: null,
    tokens: { input: 0, output: 0 },
    mine: true,
    owner: { id: 'u1', name: 'Ada' },
    bridge: {
      id: 'b1',
      connected: true,
      remote: true,
      host: 'ada-laptop',
      platform: 'linux',
      version: '0.3.0',
      opencode: '2.1.2',
      cwd: '~/sensor',
      model: '',
      seen: null,
      started: null,
    },
    may_send: true,
    why: '',
    messages: [],
    truncated: false,
    sends: [],
    asks: [],
  }) as WboDetail;

const panel = (over: Partial<WboPanel> = {}): WboPanel => ({
  session: {
    id: SID,
    title: 'Rail sag',
    status: 'idle',
    asking: false,
    since: null,
    model: { providerID: 'commandcode', providerName: 'Command Code', modelID: 'qwen', name: 'Qwen3.8 Flash', variant: 'low' },
    context: { used: 500_000, limit: 1_000_000, model: 'qwen', pct: 50 },
    context_limit: null,
    context_options: { limit: null, max: 1_000_000, steps: [64_000, 128_000, 256_000, 512_000], min: 16_000, can: true },
    computer: {
      id: 'b1',
      name: 'ada-laptop',
      connected: true,
      remote: true,
      host: 'ada-laptop',
      platform: 'linux',
      version: '0.3.0',
      opencode: '2.1.2',
      cwd: '~/sensor',
      model: '',
      seen: null,
      started: null,
    },
  },
  series: {
    context: [
      { turn: 1, at: NOW - 180_000, used: 200_000, limit: 1_000_000 },
      { turn: 2, at: NOW - 120_000, used: 380_000, limit: 1_000_000 },
      { turn: 3, at: NOW - 60_000, used: 500_000, limit: 1_000_000 },
    ],
    spans: [
      { start: NOW - 180_000, end: NOW - 170_000, cat: 'read', tool: 'read', title: 'src/a.ts', status: 'completed', part: 'msg_a' },
      { start: NOW - 170_000, end: NOW - 100_000, cat: 'shell', tool: 'shell', title: 'npm test', status: 'error', part: 'msg_b' },
      { start: NOW - 100_000, end: NOW - 90_000, cat: 'edit', tool: 'edit', title: 'src/a.ts', status: 'completed', part: 'msg_a' },
    ],
    rate: { step: 60_000, items: [{ at: NOW - 120_000, n: 120 }, { at: NOW - 60_000, n: 300 }] },
    diff_series: [{ at: NOW - 120_000, add: 5, del: 1 }, { at: NOW - 60_000, add: 12, del: 3 }],
  },
  todos: { items: [{ content: 'read the reducer', status: 'completed' }, { content: 'rewrite the footer', status: 'pending' }], done: 1, total: 2, at: NOW },
  files: {
    items: [{ path: '/w/src/a.ts', count: 2, at: NOW - 60_000, status: 'completed', error: false, message: 'msg_a', additions: 12, deletions: 3 }],
    more: 0,
  },
  tools: { items: [{ name: 'shell', server: '', count: 23, errors: 1, message: 'msg_b', tool: 'shell' }], more: 0 },
  tokens: { input: 3_100_000, output: 133_000, cache_read: 180_100_000, cache_write: 0, cost: 0.3 },
  pending: [
    {
      id: 'per_1',
      kind: 'permission',
      action: 'shell',
      resources: ['rm -rf build'],
      status: 'pending',
      at: NOW,
    },
  ],
  may_answer: true,
  why: '',
  at: NOW,
  ...over,
});

function fakeClient(p: WboPanel) {
  return {
    wboSession: jest.fn(async () => detail()),
    wboBlocked: undefined,
    side: jest.fn(async () => SIDE_EMPTY),
    sidePanel: jest.fn(async () => SIDE_EMPTY),
    wboPanel: jest.fn(async () => p),
    wboAnswer: jest.fn(async () => ({ id: 'per_1', status: 'replied' })),
    s2Streams: jest.fn(async () => false),
    models: jest.fn(async () => []),
    wboMessageImagePath: () => '',
  };
}

async function open(p: WboPanel) {
  const client = fakeClient(p);
  await render(
    <LiveContext.Provider value={hub}>
      <OpencodeSessionScreen sid={SID} client={client as unknown as WorkbenchClient} t={t} lang="en" />
    </LiveContext.Provider>,
  );
  await act(async () => undefined);
  await fireEvent.press(screen.getByTestId('wbo-column'));
  await act(async () => undefined);
  return client;
}

(canRender ? describe : describe.skip)('a session\'s column on the phone', () => {
  it('opens from the "i" beside the title, with every section it has something to say in', async () => {
    const client = await open(panel());
    expect(client.wboPanel).toHaveBeenCalledWith(SID);
    // the order the column draws them in: what a session is, what it is doing, what it changed
    const seen = screen.getAllByTestId(/^wbo-sec-/).map((n) => String(n.props.testID).replace('wbo-sec-', ''));
    expect(seen).toEqual(['model', 'flow', 'files']);
    // the waiting question is a line above them, not a section: its card is the conversation's
    expect(screen.getByTestId('wbo-panel-waiting')).toHaveTextContent(/Waiting: 1 permission/);
    // the head's own numbers: the changed lines, and nothing of the tools (they are in the flow)
    expect(screen.getByTestId('wbo-count-files')).toHaveTextContent('+12 −3');
    // the graphs: the window over the turns, the run as a strip, the changed lines' shape
    expect(screen.getByTestId('wbo-panel-ctxchart')).toBeTruthy();
    expect(screen.getByTestId('wbo-panel-strip')).toBeTruthy();
    expect(screen.getByTestId('wbo-diff-spark')).toBeTruthy();
    // the computer is one line at the foot, and its details are under it
    expect(screen.getByTestId('wbo-panel-foot')).toHaveTextContent(/ada-laptop · connected/);
    expect(screen.getByTestId('wbo-panel-model')).toHaveTextContent('Qwen3.8 Flash');
    expect(screen.getByText('Command Code · thinking: low')).toBeTruthy();
    expect(screen.getByTestId('wbo-panel-context')).toHaveTextContent('500k / 1M · 50%');
    // what it spent, in one line (the numbers whole in the grid under it, caches included)
    expect(screen.getByText(/\$0\.30 · 3\.1M in · 133\.00k out/)).toBeTruthy();
    expect(screen.getByText('180.1M')).toBeTruthy();
    // the state is under the sheet's title, once - never a line under the cost
    expect(screen.getByText('Rail sag · idle')).toBeTruthy();
    expect(screen.queryByText(/^idle$/i)).toBeNull();
  });

  it('draws no section that has nothing in it', async () => {
    await open(
      panel({
        todos: null,
        files: null,
        tools: null,
        pending: [],
        series: { context: [], spans: [], rate: null, diff_series: null },
      }),
    );
    expect(screen.getByTestId('wbo-sec-model')).toBeTruthy();
    expect(screen.queryByTestId('wbo-sec-flow')).toBeNull();
    expect(screen.queryByTestId('wbo-sec-files')).toBeNull();
    expect(screen.queryByTestId('wbo-panel-waiting')).toBeNull();
    // a session with no turns has no line to draw: the numbers are said in words instead
    expect(screen.queryByTestId('wbo-panel-ctxchart')).toBeNull();
  });

  it('folds a section as the person folds it, and keeps it on the server', async () => {
    const client = await open(panel());
    expect(screen.getByTestId('wbo-panel-file')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wbo-sec-files'));
    await act(async () => undefined);
    expect(screen.queryByTestId('wbo-panel-file')).toBeNull();
    expect(client.sidePanel).toHaveBeenCalledWith('files', false);
    await fireEvent.press(screen.getByTestId('wbo-sec-files'));
    await act(async () => undefined);
    expect(client.sidePanel).toHaveBeenLastCalledWith('files', true);
    expect(screen.getByTestId('wbo-panel-file')).toBeTruthy();
  });

  it('keeps the tools in the flow, behind one link, and jumps to the call', async () => {
    const client = await open(panel());
    // no section of their own: the strip is the distribution, this is the list behind it
    expect(screen.queryByTestId('wbo-sec-tools')).toBeNull();
    expect(screen.getByText(t.whichTools)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wbo-panel-tools'));
    await act(async () => undefined);
    const row = await screen.findByTestId('wbo-panel-tool');
    await fireEvent.press(row);
    await act(async () => undefined);
    expect(client.wboSession).toHaveBeenCalled();
  });

  it('goes to the question\'s own card instead of answering a second time here', async () => {
    const client = await open(panel());
    expect(screen.queryByText(t.allowOnce)).toBeNull();
    await fireEvent.press(screen.getByTestId('wbo-panel-waiting'));
    await act(async () => undefined);
    expect(client.wboAnswer).not.toHaveBeenCalled();
  });

  it('says why a question is answered in the conversation, and where it is', async () => {
    await open(
      panel({
        pending: [
          {
            id: 'frm_1',
            kind: 'form',
            title: 'Which output?',
            fields: [{ key: 'q0', type: 'string', title: 'Which output?', options: [], custom: true, required: true }],
            status: 'pending',
            at: NOW,
            message: 'msg_c',
          },
        ],
      }),
    );
    expect(screen.getByTestId('wbo-panel-waiting')).toHaveTextContent(/Waiting: 1 question/);
    expect(screen.getByText(t.answerInConversation)).toBeTruthy();
    expect(screen.queryByText(t.allowOnce)).toBeNull();
  });

  it('says what waits for someone who may not answer it, and offers no buttons', async () => {
    const client = await open(panel({ may_answer: false }));
    expect(screen.getByTestId('wbo-panel-waiting')).toHaveTextContent(/Waiting: 1 permission/);
    expect(screen.queryByText(t.allowOnce)).toBeNull();
    expect(client.wboAnswer).not.toHaveBeenCalled();
  });

  it('draws the recent calls list under the strip and jumps to message on tap', async () => {
    const client = await open(
      panel({
        series: {
          context: [],
          spans: [
            { start: NOW - 60_000, end: NOW - 30_000, cat: 'shell', tool: 'shell', title: 'npm test', status: 'completed', part: 'msg_b' },
          ],
          bands: [
            { start: NOW - 120_000, end: NOW - 60_000, cat: 'text', tool: 'text', title: 'thinking', status: 'completed', part: 'msg_a' },
          ],
          recent: [
            { tool: 'shell', cat: 'shell', title: 'npm test', status: 'completed', start: NOW - 60_000, end: NOW - 30_000, part: 'msg_b', add: 3, del: 1 },
          ],
          rate: null,
          diff_series: null,
        },
      }),
    );
    // Writing is never in the legend
    expect(screen.queryByText(/writing/i)).toBeNull();
    // Tool call is in legend
    expect(screen.getAllByText(/shell/i).length).toBeGreaterThan(0);
    // Recent list item is rendered with diff
    const recentRow = await screen.findByTestId('wbo-panel-recent');
    expect(recentRow).toHaveTextContent(/npm test/);
    expect(recentRow).toHaveTextContent(/\+3 −1/);
    await fireEvent.press(recentRow);
    await act(async () => undefined);
    expect(client.wboSession).toHaveBeenCalled();
  });

  it('shows stall warning when quiet for longer than stall threshold', async () => {
    await open(
      panel({
        session: {
          ...panel().session,
          status: 'busy',
          since: NOW - 200_000,
        },
        series: {
          context: [],
          spans: [],
          recent: [
            { tool: 'shell', cat: 'shell', title: 'long command', status: 'running', start: NOW - 190_000, end: null, part: 'msg_s' },
          ],
          rate: null,
          diff_series: null,
        },
      }),
    );
    expect(screen.getByText(/nothing new for 3 min/i)).toBeTruthy();
  });
});

describe('the window a session keeps to', () => {
  it('offers the sizes below the model\'s own, and sends the one picked', async () => {
    const p = panel();
    const client = {
      ...fakeClient(p),
      wboContext: jest.fn(async () => ({ ok: true, limit: 128_000, scope: 'session' })),
    } as unknown as WorkbenchClient & { wboContext: jest.Mock };
    await render(
      <LiveContext.Provider value={hub}>
        <OpencodeSessionScreen sid={SID} client={client} t={t} lang="en" />
      </LiveContext.Provider>,
    );
    await act(async () => undefined);
    await fireEvent.press(screen.getByTestId('wbo-column'));
    await act(async () => undefined);
    expect(screen.getByTestId('wbo-panel-ctxpick')).toBeTruthy();
    expect(screen.getByText(/the model's own · 1M/)).toBeTruthy();
    await fireEvent.press(screen.getByText('128k'));
    await act(async () => undefined);
    expect(client.wboContext).toHaveBeenCalledWith(SID, 128_000);
  });
});
