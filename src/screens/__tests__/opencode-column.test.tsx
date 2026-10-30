/**
 * A session's column on the phone (components/SessionPanelSheet.tsx, lib/wboPanel.ts): the "i" beside the
 * session's title opens what the web's right-hand column shows - the model and its window, the files it
 * changed, what it waits for, the tools it used - and the rules of that column: a section with nothing in it is
 * not drawn, a section folds as the person folded it (kept on the server), and a permission is answered from
 * here.
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
    // the order the column draws them in: what needs a person first
    const order = [...['pending', 'todos', 'files', 'model', 'computer', 'tools']];
    const seen = screen.getAllByTestId(/^wbo-sec-/).map((n) => String(n.props.testID).replace('wbo-sec-', ''));
    expect(seen).toEqual(order);
    // the head's own numbers: what waits, how many files, how many tool calls
    expect(screen.getByTestId('wbo-count-todos')).toHaveTextContent('1/2');
    expect(screen.getByTestId('wbo-count-files')).toHaveTextContent('1');
    expect(screen.getByTestId('wbo-count-pending')).toHaveTextContent('1');
    expect(screen.getByTestId('wbo-count-tools')).toHaveTextContent('23');
    expect(screen.getByTestId('wbo-panel-model')).toHaveTextContent('Qwen3.8 Flash');
    expect(screen.getByText('Command Code · thinking: low')).toBeTruthy();
    expect(screen.getByTestId('wbo-panel-context')).toHaveTextContent('500k / 1M · 50%');
    // what it spent: the two tight columns the web has, caches included, the cost under them
    expect(screen.getByText('3.1M')).toBeTruthy();
    expect(screen.getByText('180.1M')).toBeTruthy();
    expect(screen.getByText('$0.30')).toBeTruthy();
    // the state is under the sheet's title, once - never a line under the cost
    expect(screen.getByText('Rail sag · idle')).toBeTruthy();
    expect(screen.queryByText(/^idle$/i)).toBeNull();
  });

  it('draws no section that has nothing in it', async () => {
    await open(panel({ todos: null, files: null, tools: null, pending: [] }));
    expect(screen.getByTestId('wbo-sec-model')).toBeTruthy();
    expect(screen.getByTestId('wbo-sec-computer')).toBeTruthy();
    expect(screen.queryByTestId('wbo-sec-todos')).toBeNull();
    expect(screen.queryByTestId('wbo-sec-files')).toBeNull();
    expect(screen.queryByTestId('wbo-sec-tools')).toBeNull();
    expect(screen.queryByTestId('wbo-sec-pending')).toBeNull();
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

  it('says the tools by name in a folded head, and how many calls when it is open', async () => {
    const client = await open(panel());
    await fireEvent.press(screen.getByTestId('wbo-sec-tools'));
    await act(async () => undefined);
    expect(screen.getByTestId('wbo-count-tools')).toHaveTextContent('⚠1 shell 23');
    await fireEvent.press(screen.getByTestId('wbo-sec-tools'));
    await act(async () => undefined);
    expect(screen.getByTestId('wbo-count-tools')).toHaveTextContent('23');
    expect(client.sidePanel).toHaveBeenCalled();
  });

  it('answers a permission from the sheet', async () => {
    const client = await open(panel());
    await fireEvent.press(screen.getByText(t.allowOnce));
    await act(async () => undefined);
    expect(client.wboAnswer).toHaveBeenCalledWith(SID, 'per_1', { decision: 'once' });
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
    expect(screen.getByText(t.answerOnComputer)).toBeTruthy();
    expect(screen.getByText(t.showInConversation)).toBeTruthy();
  });

  it('does not answer for someone who may not', async () => {
    const client = await open(panel({ may_answer: false }));
    await fireEvent.press(screen.getByText(t.allowOnce));
    await act(async () => undefined);
    expect(client.wboAnswer).not.toHaveBeenCalled();
    expect(screen.getByText(t.onlyOwnerAnswers)).toBeTruthy();
  });
});
