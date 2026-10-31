/**
 * An OpenCode session on the phone: its conversation in the Chat's look,
 * what OpenCode asks answered from here, live records laid on, the note in
 * place of the box when it cannot be written to - and the drawer's groups
 * folding and pinning as the person chose on the server.
 */
import * as React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { BusEvent, WboDetail, WboSession } from '../../api/types';
import { DrawerPanel } from '../../components/DrawerPanel';
import { BusPace, type LiveHub } from '../../live/hub';
import { LiveContext } from '../../live/LiveContext';
import { SIDE_EMPTY, withPin } from '../../lib/side';
import { wbcStrings } from '../../lib/wbcStrings';
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

jest.mock('../../lib/pictureFile', () => ({ readPictureHead: jest.fn(() => null) }));
const ImagePicker = jest.requireMock('expo-image-picker') as Record<string, jest.Mock>;
const { readPictureHead } = jest.requireMock('../../lib/pictureFile') as { readPictureHead: jest.Mock };

const canRender = typeof (React as { act?: unknown }).act === 'function';
const en = wboStrings('en');
const tr = wboStrings('tr');
const NOW = Date.now();
const SID = 'ses_rail00001';

function fakeHub() {
  const subs: { kinds: string[]; fn: (e: BusEvent) => void }[] = [];
  const follows: { onRecord: (v: unknown) => void; opts: { stream?: string } }[] = [];
  const hub = {
    live: () => false,
    onLive: () => () => true,
    on: (kinds: string | string[], fn: (e: BusEvent) => void) => {
      const s = { kinds: Array.isArray(kinds) ? kinds : [kinds], fn };
      subs.push(s);
      return () => subs.splice(subs.indexOf(s), 1);
    },
    pace: (ms = 60_000) => new BusPace({ live: () => false }, ms),
    follow: (onRecord: (v: unknown) => void, opts: { stream?: string }) => {
      follows.push({ onRecord, opts });
      return { start() {}, stop() {}, pause() {}, resume() {}, live: () => false };
    },
    drop() {},
  };
  return { hub: hub as unknown as LiveHub, follows };
}

/** A scroll event as the inverted list sends it: how far from the newest line (offset 0). */
const scrollOf = (y: number) => ({
  nativeEvent: {
    contentOffset: { x: 0, y },
    contentSize: { width: 390, height: 2400 },
    layoutMeasurement: { width: 390, height: 700 },
  },
});

const row = (over: Partial<WboSession> = {}): WboSession => ({
  session_id: SID,
  title: 'Rail sag',
  name: 'Rail sag',
  status: 'idle',
  directory: '~/sensor',
  computer: 'ada-laptop',
  updated: NOW - 60_000,
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
    version: '0.2.0',
    opencode: '2.1.2',
    cwd: '~/sensor',
    model: '',
    seen: null,
    started: null,
  },
  may_send: true,
  why: '',
  ...over,
});

const detail = (over: Partial<WboDetail> = {}): WboDetail => ({
  ...row(),
  messages: [
    {
      id: 'msg_u1',
      role: 'user',
      time: NOW - 50_000,
      done: NOW - 50_000,
      parts: [{ id: 't0', type: 'text', text: 'Why does the rail sag?' }],
    },
    {
      id: 'msg_a1',
      role: 'assistant',
      model: 'deepseek/deepseek-v4',
      time: NOW - 49_000,
      done: NOW - 40_000,
      parts: [
        { id: 'r0', type: 'reasoning', text: 'Look at the regulator.' },
        { id: 'call_1', type: 'tool', tool: 'read', status: 'completed', title: 'power.kicad_sch', output: 'U3 LDO' },
        { id: 't0', type: 'text', text: 'The **LDO** drops out.' },
        { id: 'call_q', type: 'tool', tool: 'question', status: 'running' },
      ],
    },
  ],
  truncated: false,
  sends: [],
  asks: [
    {
      id: 'frm_ask00001',
      kind: 'form',
      part: 'call_q',
      status: 'pending',
      at: NOW / 1000,
      settled_at: null,
      fields: [
        {
          key: 'q0',
          type: 'string',
          title: 'Fix',
          description: 'Which fix?',
          custom: true,
          required: true,
          options: [
            { value: 'cap', label: 'Bigger cap', description: 'Add 22 uF' },
            { value: 'ldo', label: 'Other LDO', description: '' },
          ],
        },
      ],
    },
  ],
  ...over,
});

function fakeClient(d: WboDetail) {
  return {
    wboSession: jest.fn(async () => d),
    wboAnswer: jest.fn(async (_s: string, id: string) => ({
      ...d.asks![0],
      id,
      status: 'answering',
      chosen: { answer: { q0: 'cap' } },
    })),
    wboSend: jest.fn(async () => ({
      id: 'abcd',
      text: 'hi',
      by: {},
      status: 'queued',
      error: '',
      at: NOW / 1000,
      updated: null,
      delivered_at: null,
      inbox: null,
    })),
    wboMessageImagePath: (s: string, m: string, n: number) => `/api/wbo/sessions/${s}/messages/${m}/images/${n}`,
    s2Streams: jest.fn(async () => true),
    // The app's own models, for the window a run's model has (no Context row here).
    models: jest.fn(async () => []),
  };
}

async function show(d: WboDetail, t = en) {
  const client = fakeClient(d);
  const live = fakeHub();
  await render(
    <LiveContext.Provider value={live.hub}>
      <OpencodeSessionScreen
        sid={SID}
        client={client as unknown as WorkbenchClient}
        t={t}
        lang="en"
      />
    </LiveContext.Provider>,
  );
  await act(async () => undefined);
  return { client, live };
}

(canRender ? describe : describe.skip)('an OpenCode session', () => {
  it('draws the conversation plainly, with the state', async () => {
    await show(detail());
    expect(screen.getByTestId('wbo-title')).toHaveTextContent('Rail sag');
    expect(screen.getByText('Why does the rail sag?')).toBeTruthy();
    // What the answer did is behind one line, not a row per tool call.
    expect(screen.getByText('1 tool call · thinking 22 chars')).toBeTruthy();
    expect(screen.queryByText('read · power.kicad_sch')).toBeNull();
    // The answer displays which model gave it.
    expect(screen.getByText('deepseek-v4')).toBeTruthy();
    expect(screen.queryByText('On the computer')).toBeNull();
    expect(screen.queryByText(/tok\/s/)).toBeNull();
    expect(screen.getByTestId('wbo-composer')).toBeTruthy();
  });

  it('opens model picker sheet and picks a model', async () => {
    const s = detail({
      models: [
        { providerID: 'workbench', providerName: 'Workbench', modelID: 'm-1', name: 'Model 1', context: 1000000, output: 384000, vision: true, variants: [] },
      ],
    });
    const { client } = await show(s);
    client.wboSelectModel = jest.fn(async () => ({ ok: true, selected_model: { providerID: 'workbench', modelID: 'm-1', name: 'Model 1' } }));
    expect(screen.getByTestId('wbo-model-picker')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wbo-model-picker'));
    expect(screen.getByText('Model 1')).toBeTruthy();
    await fireEvent.press(screen.getByText('Model 1'));
    expect(client.wboSelectModel).toHaveBeenCalledWith(SID, { providerID: 'workbench', modelID: 'm-1', variant: undefined });
  });

  it('shows model picker disabled with notice when bridge is not connected', async () => {
    const s = detail({
      bridge: { ...row().bridge!, connected: false },
    });
    await show(s);
    expect(screen.getByTestId('wbo-model-picker')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wbo-model-picker'));
    expect(screen.getByText('The computer is not connected')).toBeTruthy();
  });

  it('draws a system line when model is switched', async () => {
    const s = detail({
      messages: [
        { id: 'msg_1', role: 'user', time: 1000, parts: [{ id: 't0', type: 'text', text: 'hi' }] },
        { id: 'msg_sw', role: 'system', type: 'model-switched', time: 1500, model: { modelID: 'm-new', name: 'Model New', providerID: 'p' }, previous: { modelID: 'm-old', name: 'Model Old', providerID: 'p' }, by: 'chat', parts: [] },
      ],
    });
    await show(s);
    expect(screen.getByTestId('wbo-system-row')).toHaveTextContent('Model changed: Model Old → Model New (from Chat)');
  });

  it('sends a picture from the phone as the bytes on disk say it is, and says when the picker fails', async () => {
    const { client } = await show(detail());
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/b.jpeg', fileName: 'IMG_1.HEIC', mimeType: 'image/heif', fileSize: 8e6 }],
    });
    readPictureHead.mockReturnValueOnce({ size: 900_000, head: [0xff, 0xd8, 0xff, 0xdb] });
    await fireEvent.press(screen.getByTestId('wbo-attach'));
    await fireEvent.press(screen.getByTestId('action-wbo-photos'));
    await act(async () => undefined);
    expect(screen.queryByTestId('wbo-pic-error')).toBeNull();
    await fireEvent.press(screen.getByTestId('send'));
    await act(async () => undefined);
    expect(client.wboSend).toHaveBeenCalledWith(SID, '', [{ uri: 'file:///cache/b.jpeg', name: 'IMG_1.jpg', type: 'image/jpeg' }]);
    ImagePicker.launchImageLibraryAsync.mockRejectedValueOnce(new Error('no'));
    await fireEvent.press(screen.getByTestId('wbo-attach'));
    await fireEvent.press(screen.getByTestId('action-wbo-photos'));
    await act(async () => undefined);
    expect(screen.getByText(en.pickFailed)).toBeTruthy();
  });

  it("puts an answer's work behind one line, and opens it", async () => {
    await show(detail());
    // The line says what was done: one tool read, and how much it thought.
    expect(screen.getByText('1 tool call · thinking 22 chars')).toBeTruthy();
    // Nothing of the work is out until the line is opened.
    expect(screen.queryByText('Look at the regulator.')).toBeNull();
    expect(screen.queryByText('read · power.kicad_sch')).toBeNull();
    // What the answer says, and what it asks, stay where they belong.
    expect(screen.getByText('LDO')).toBeTruthy();
    expect(screen.getByText('Which fix?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('compact-work'));
    expect(screen.getByText('Look at the regulator.')).toBeTruthy();
    expect(screen.getByText('read · power.kicad_sch')).toBeTruthy();
  });

  it('follows an answer as it streams, and stays put for a reader further up', async () => {
    await show(detail());
    const list = screen.getByTestId('wbo-list');
    const to = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => undefined);
    const frame = async () => {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 70));
      });
    };

    // The list keeping its own place as a tool call or a thought arrives - which it
    // sends as a scroll - is not the reader: it still follows them.
    await fireEvent.scroll(list, scrollOf(240));
    await fireEvent(list, 'contentSizeChange', 390, 2600);
    await frame();
    expect(to).toHaveBeenCalledWith({ offset: 0, animated: false });

    // A finger is: reading further up and the page is left exactly where it was.
    to.mockClear();
    await fireEvent(list, 'scrollBeginDrag', scrollOf(240));
    await fireEvent.scroll(list, scrollOf(900));
    await fireEvent(list, 'scrollEndDrag', scrollOf(900));
    await fireEvent(list, 'contentSizeChange', 390, 2800);
    await frame();
    expect(to).not.toHaveBeenCalled();
    to.mockRestore();
  });

  it('leaves the word out while OpenCode works - the dot says it', async () => {
    await show(detail({ status: 'busy' }));
    expect(screen.getByTestId('wbo-state')).not.toHaveTextContent('working');
    expect(screen.getByTestId('wbo-state')).toHaveTextContent(/OpenCode · ada-laptop/);
  });

  it('says the state and where it runs in the header, and keeps the folder out of it', async () => {
    await show(detail());
    // "<state> · OpenCode · <computer>" - the same shape a Claude session's line has
    expect(screen.getByTestId('wbo-state')).toHaveTextContent(/^ready · OpenCode · ada-laptop$/);
    expect(screen.getByTestId('wbo-state')).not.toHaveTextContent('sensor');
  });

  it("keeps the header's waiting word short so the computer still fits the line", async () => {
    await show(detail({ status: 'waiting' }));
    expect(screen.getByTestId('wbo-state')).toHaveTextContent(/^waiting · OpenCode · ada-laptop$/);
  });

  it('says an old wb-opencode, or an MCP server that fell off, as a small warn badge', async () => {
    await show(detail({ bridge: { ...row().bridge!, outdated: true, latest: '0.3.0' } }));
    expect(screen.getByTestId('wbo-flag')).toHaveTextContent(/update/i);
    expect(screen.getByTestId('wbo-state')).toHaveTextContent(/OpenCode · ada-laptop/);
    // The badge is the bar's tag line under the title, not a word in the line the computer is on.
    expect(screen.getByTestId('wbo-state')).not.toHaveTextContent(/update/i);
  });

  it('says nothing about an old wb-opencode that keeps itself current', async () => {
    await show(detail({ bridge: { ...row().bridge!, outdated: true, latest: '0.3.0', self_updates: true } }));
    expect(screen.queryByTestId('wbo-flag')).toBeNull();
  });

  it('says an MCP server of that computer that is down beside it', async () => {
    await show(
      detail({
        bridge: {
          ...row().bridge!,
          mcp: [
            { name: 'workbench', status: 'connected' },
            { name: 'files', status: 'failed' },
          ],
        },
      }),
    );
    expect(screen.getByTestId('wbo-flag')).toHaveTextContent('MCP 1/2');
  });

  it('answers what OpenCode asks from the phone', async () => {
    const { client } = await show(detail());
    expect(screen.getByText('Which fix?')).toBeTruthy();
    expect(screen.getByText('Add 22 uF')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ask-opt-q0-cap'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('ask-answer'));
    });
    expect(client.wboAnswer).toHaveBeenCalledWith(SID, 'frm_ask00001', { answer: { q0: 'cap' } });
    expect(screen.getByText('sending your answer…')).toBeTruthy();
    expect(screen.getByText('Bigger cap')).toBeTruthy();
  });

  it('answers a permission with Allow once / Always allow / Reject', async () => {
    const d = detail({
      asks: [
        {
          id: 'per_ask00001',
          kind: 'permission',
          action: 'bash',
          resources: ['rm -rf build'],
          save: ['rm *'],
          part: 'call_q',
          status: 'pending',
          at: 1,
          settled_at: null,
        },
      ],
    });
    const { client } = await show(d);
    expect(screen.getByText('OpenCode asks to run bash')).toBeTruthy();
    expect(screen.getByText('rm -rf build')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('ask-always'));
    });
    expect(client.wboAnswer).toHaveBeenCalledWith(SID, 'per_ask00001', { decision: 'always' });
  });

  it("shows an answered card's choice and where it came from, in Turkish too", async () => {
    const base = detail();
    await show(
      detail({
        asks: [{ ...base.asks![0], status: 'answered', via: 'computer', answer: { q0: 'ldo' }, settled_at: 1 }],
      }),
      tr,
    );
    expect(screen.getByText('bilgisayarda cevaplandı')).toBeTruthy();
    expect(screen.getByText('Other LDO')).toBeTruthy();
    expect(screen.queryByTestId('ask-answer')).toBeNull();
  });

  it('lays the stream wbo on as it comes', async () => {
    const { live } = await show(detail());
    const f = live.follows.find((x) => x.opts.stream === 'wbo');
    expect(f).toBeTruthy();
    await act(async () => {
      f!.onRecord({
        type: 'message',
        session: SID,
        id: 'msg_a2',
        role: 'assistant',
        model: 'm/x',
        time: NOW,
        done: null,
      });
      f!.onRecord({ type: 'delta', session: SID, message: 'msg_a2', part: 't0', delta: 'Live ', o: 0 });
      f!.onRecord({ type: 'delta', session: SID, message: 'msg_a2', part: 't0', delta: 'words', o: 5 });
      f!.onRecord({ type: 'delta', session: 'ses_other0001', message: 'msg_a2', part: 't0', delta: 'NOT', o: 10 });
    });
    expect(screen.getByText('Live words')).toBeTruthy();
  });

  it('puts the note in place of the box when it cannot be written to, and says update', async () => {
    const d = detail({ may_send: false, why: 'not-yours', mine: false, owner: { id: 'u2', name: 'Bo' } });
    d.bridge!.outdated = true;
    await show(d);
    expect(screen.queryByTestId('wbo-composer')).toBeNull();
    expect(screen.getByTestId('wbo-why')).toHaveTextContent('Only Bo can write to this session; you can read it.');
    expect(screen.queryByTestId('ask-answer')).toBeNull();
    expect(screen.getByTestId('wbo-flag')).toHaveTextContent('update');
  });

  it('draws a question an old wb-opencode did not forward as its card, not answerable, and asks for the update', async () => {
    const d = detail({ asks: [] });
    d.bridge = { ...d.bridge!, connected: false, version: '0.1.0', latest: '0.2.0', outdated: true, answers: false };
    d.messages[1].parts[3] = {
      id: 'call_q',
      type: 'tool',
      tool: 'question',
      status: 'running',
      input: JSON.stringify({
        questions: [
          {
            header: 'Fix',
            question: 'Which fix?',
            options: [
              { label: 'LDO', description: 'swap the regulator' },
              { label: 'Cap', description: 'more bulk capacitance' },
            ],
          },
        ],
      }),
    };
    await show(d);
    // The warning is one small word in the header's own line now, not a box under it.
    expect(screen.getByTestId('wbo-flag')).toHaveTextContent('update');
    expect(screen.getByTestId('wbo-state')).toHaveTextContent(/OpenCode · ada-laptop/);
    expect(screen.getByText('Which fix?')).toBeTruthy();
    expect(screen.getByTestId('ask-ro-q0-LDO')).toHaveTextContent('LDOswap the regulator');
    expect(screen.queryByTestId('ask-opt-q0-LDO')).toBeNull();
    expect(screen.queryByTestId('ask-answer')).toBeNull();
    expect(screen.getByTestId('ask-state')).toHaveTextContent('waiting for an answer');
    expect(screen.getByTestId('ask-note')).toHaveTextContent(
      'Update wb-opencode on that computer to answer here (run its installer again)',
    );
    expect(screen.queryByText('question')).toBeNull();
  });
});

(canRender ? describe : describe.skip)('the drawer groups', () => {
  const many = Array.from({ length: 7 }, (_, i) =>
    row({
      session_id: `ses_row0000${i}`,
      name: `Run ${i}`,
      bridge: i ? null : row().bridge,
      updated: NOW - i * 60_000,
    }),
  );
  const draw = (side = SIDE_EMPTY, extra: Record<string, unknown> = {}) => (
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
      wbo={{ t: en, rows: many }}
      onWbo={jest.fn()}
      wbc={{ t: wbcStrings('en'), rows: [] }}
      onWbc={jest.fn()}
      side={side}
      {...extra}
    />
  );

  it('opens a live group with the newest five and "Show N more"', async () => {
    await render(draw());
    expect(screen.getByText('OpenCode sessions')).toBeTruthy();
    expect(screen.getByText('Run 4')).toBeTruthy();
    expect(screen.queryByText('Run 5')).toBeNull();
    expect(screen.getByTestId('wbo-dot-ses_row00000')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show 2 more'));
    expect(screen.getByText('Run 6')).toBeTruthy();
  });

  it('says under a row only what it needs from the person', async () => {
    await render(
      draw(SIDE_EMPTY, {
        wbo: {
          t: en,
          rows: [row({ status: 'busy' }), row({ session_id: 'ses_wait11111', name: 'Wait', status: 'waiting' })],
        },
      }),
    );
    // A working one is the dot's own news: no line under it at all, and the
    // computer is told to a screen reader instead.
    expect(screen.getByLabelText(/^Rail sag, working · ada-laptop$/)).toBeTruthy();
    expect(screen.queryByText('working · ada-laptop')).toBeNull();
    expect(screen.queryByText('ada-laptop')).toBeNull();
    // The waiting one has something to say, and says only that.
    expect(screen.getByText('waiting for your answer')).toBeTruthy();
  });

  it('folds by the header, keeping the pinned in sight, as the person chose', async () => {
    const onFold = jest.fn();
    const side = { ...withPin(SIDE_EMPTY, 'opencode', 'ses_row00006', true), folds: { claude: null, opencode: false, rooms: null, agents: null } };
    await render(draw(side, { onFold }));
    expect(screen.getByText('Run 6')).toBeTruthy();
    expect(screen.queryByText('Run 0')).toBeNull();
    // The group's heading says nothing about what is live: the rows' own dots do.
    expect(screen.queryByTestId('drawer-wbo-dot')).toBeNull();
    expect(screen.getByTestId('wbo-pin-ses_row00006')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('drawer-wbo-fold'));
    expect(onFold).toHaveBeenCalledWith('opencode', true);
  });

  it('pins and unpins from a long press', async () => {
    const onPin = jest.fn();
    await render(draw(SIDE_EMPTY, { onPin }));
    await fireEvent(screen.getByTestId('wbo-ses_row00001'), 'longPress');
    await fireEvent.press(screen.getByText('Pin'));
    expect(onPin).toHaveBeenCalledWith('opencode', 'ses_row00001', true);
  });
});
