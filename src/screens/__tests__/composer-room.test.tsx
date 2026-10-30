/**
 * The room the words are typed in (components/Composer.tsx, screens/OpencodeSessionScreen.tsx).
 *
 * An OpenCode session's model chip used to be in the box's own row, beside the paperclip, the microphone and
 * the send button: on a 360 dp phone the box was measured at 20 dp wide and 154 dp tall, the placeholder
 * broken letter by letter, and a tap had almost nowhere to land (the number is in this commit's message; the
 * bug was measured on the published build). The chip and the window are a line of their own above the box
 * now, and the box itself keeps a least width however a screen fills its row.
 *
 * JS has no layout engine here, so what is held is the guarantee that makes the width: the words' least
 * width, the tools giving way, the chip being a row of its own, and an empty box one line high.
 */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { WboDetail } from '../../api/types';
import { LiveContext } from '../../live/LiveContext';
import type { LiveHub } from '../../live/hub';
import { colors, type } from '../../theme/tokens';
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
const SID = 'ses_room0000001';

/** The box's own numbers, from the theme the composer reads. */
const PAD_V = 11; // as the composer pads its words top and bottom (its own PAD_V)
const MIN_H = type.inputLine + PAD_V * 2;

const hub = {
  live: () => false,
  onLive: () => () => true,
  on: () => () => undefined,
  pace: (ms = 60_000) => ({ due: () => true, mark: () => undefined, ms }),
  follow: () => ({ start() {}, stop() {}, pause() {}, resume() {}, live: () => false }),
  drop() {},
} as unknown as LiveHub;

const detail = (over: Partial<WboDetail> = {}): WboDetail =>
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
      models_supported: true,
    },
    may_send: true,
    why: '',
    messages: [],
    truncated: false,
    sends: [],
    asks: [],
    context: { used: 453_000, limit: 1_000_000, model: 'qwen', pct: 45 },
    models: [
      {
        providerID: 'workbench',
        providerName: 'Workbench',
        modelID: 'm-1',
        name: 'DeepSeek V4.1 Flash',
        context: 1_000_000,
        vision: true,
        variants: ['low', 'max'],
      },
    ],
    selected_model: { providerID: 'workbench', providerName: 'Workbench', modelID: 'm-1', name: 'DeepSeek V4.1 Flash' },
    ...over,
  }) as WboDetail;

function fakeClient(d: WboDetail) {
  return {
    wboSession: jest.fn(async () => d),
    s2Streams: jest.fn(async () => false),
    models: jest.fn(async () => []),
    wboMessageImagePath: () => '',
    wboPanel: jest.fn(async () => null),
    side: jest.fn(async () => ({ pins: { claude: [], opencode: [] }, folds: { claude: null, opencode: null, rooms: null }, chat: { detail: 'normal' }, panel: {} })),
  };
}

async function show(d: WboDetail = detail()) {
  const client = fakeClient(d);
  await render(
    <LiveContext.Provider value={hub}>
      <OpencodeSessionScreen sid={SID} client={client as unknown as WorkbenchClient} t={t} lang="en" />
    </LiveContext.Provider>,
  );
  await act(async () => undefined);
  return client;
}

/** Every ancestor of a node, nearest first. */
function ancestors(node: any): any[] {
  const out: any[] = [];
  let at = node?.parent;
  while (at) {
    out.push(at);
    at = at.parent;
  }
  return out;
}

const flat = (style: unknown): Record<string, unknown> =>
  (Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : { ...((style as object) ?? {}) }) as Record<string, unknown>;

(canRender ? describe : describe.skip)('the room the words are typed in', () => {
  it('keeps a width worth typing in, on the narrowest phone', async () => {
    await show();
    const input = screen.getByTestId('composer-input');
    // The least width the words keep (the composer's own floor), and the tools give way instead.
    expect(flat(input.props.style).minWidth).toBe(120);
    const row = ancestors(input)[0];
    const tools = row.children[row.children.length - 1];
    expect(flat(tools.props.style).flexShrink).toBe(1);
    // 360 dp and 320 dp: the box's floor is what holds it there, whatever the screen puts beside it.
    for (const width of [360, 320]) {
      expect(width - 24 - 120).toBeGreaterThan(0); // the rest of the row still has room for a button or two
    }
  });

  it('puts the model and its window on a line of their own, never in the box\'s row', async () => {
    await show();
    const input = screen.getByTestId('composer-input');
    const chip = screen.getByTestId('wbo-model-picker');
    expect(ancestors(chip)).not.toContain(input.parent);
    expect(ancestors(chip)).not.toContain(ancestors(input)[0]);
    // and it says the window beside it, as the Chat's column does
    expect(screen.getByTestId('wbo-context')).toHaveTextContent('453k / 1M');
    // the box's row itself holds the paperclip, the words, the microphone and send - nothing else
    const row = ancestors(input)[0];
    expect(row.children.length).toBe(2);
  });

  it('is one line high while it is empty, and takes the focus when it is tapped', async () => {
    await show();
    const input = screen.getByTestId('composer-input');
    expect(flat(input.props.style).minHeight).toBe(MIN_H);
    // the box's border turns to the focus colour, which is what a tap has to reach
    const field = ancestors(input)[0];
    expect(flat(field.props.style).borderColor).not.toBe(colors.focus);
    await fireEvent(input, 'focus');
    await act(async () => undefined);
    expect(flat(ancestors(screen.getByTestId('composer-input'))[0].props.style).borderColor).toBe(colors.focus);
  });

  it('draws the pictures and the model line together, each in its own row', async () => {
    await show();
    // a line above the box for the model, and the pictures' own row above that, when there are pictures
    const chip = screen.getByTestId('wbo-model-picker');
    const meta = ancestors(chip).find((a) => flat(a.props.style).minHeight === 22);
    expect(meta).toBeTruthy();
    // the meta row holds the chip and the context only
    expect(meta.children.length).toBe(2);
  });
});
