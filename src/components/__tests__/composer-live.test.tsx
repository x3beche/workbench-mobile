/**
 * Live voice to text in the composer: the words while speaking (settled in
 * ink, the tail dimmed), the server's whole text in the box at the end and
 * never sent by itself - and the recording written out the old way whenever
 * the live path is not there or breaks.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import { colors } from '../../theme/tokens';
import { resetNoLiveNote } from '../../voice/live';
import { forgetRecording, openPcmMic } from '../../voice/pcmMic';
import { LIVE_BROKE, NO_LIVE } from '../../voice/voice';
import { FakeSocket } from '../../voice/__tests__/fakeSocket';
import { Composer } from '../Composer';

const WAV = { uri: 'file:///docs/voice-1.wav', name: 'voice.wav', type: 'audio/wav' };

const mockMic = {
  available: true,
  onPcm: null as null | ((b: Uint8Array) => void),
  stop: jest.fn(async () => WAV),
  cancel: jest.fn(async () => undefined),
};

jest.mock('../../voice/pcmMic', () => ({
  openPcmMic: jest.fn(async (onPcm: (b: Uint8Array) => void) => {
    if (!mockMic.available) throw new Error('no PCM microphone in this build');
    mockMic.onPcm = onPcm;
    return { stop: mockMic.stop, cancel: mockMic.cancel };
  }),
  forgetRecording: jest.fn(),
}));

const mockRecorder = {
  uri: 'file:///cache/rec-1.m4a',
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  stop: jest.fn(async () => undefined),
};

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a', sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 } },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => mockRecorder,
}));

async function renderComposer(mode: 'live' | 'record' = 'live') {
  const transcribe = jest.fn(async () => ({ text: 'Written out after.', language: 'tr', model: 'g', seconds: 2 }));
  const client = { base: 'https://wb.example', transcribe } as unknown as WorkbenchClient;
  const onSend = jest.fn(async () => true);
  await render(<Composer client={client} lang="tr" mode={mode} writing={false} onSend={onSend} onStop={jest.fn()} />);
  return { transcribe, onSend };
}

/** Start dictating; the socket the composer opened. */
async function dictate(): Promise<FakeSocket> {
  await fireEvent.press(screen.getByTestId('voice-start'));
  await screen.findByTestId('recording-bar');
  return FakeSocket.last();
}

async function server(fn: () => void) {
  await act(async () => fn());
}

const original = (globalThis as { WebSocket?: unknown }).WebSocket;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  FakeSocket.all = [];
  mockMic.available = true;
  mockMic.onPcm = null;
  resetNoLiveNote();
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket;
});

afterEach(() => {
  jest.useRealTimers();
  (globalThis as { WebSocket?: unknown }).WebSocket = original;
});

describe('Composer, live voice to text', () => {
  it('shows the words while speaking, then leaves the whole text in the box without sending', async () => {
    const { transcribe, onSend } = await renderComposer();
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Note:');
    const ws = await dictate();
    expect(ws.url).toBe('wss://wb.example/api/voice/live');
    await server(() => {
      ws.open();
      ws.say({ type: 'ready', model: 'small' });
    });
    expect(ws.messages()[0]).toMatchObject({ type: 'start', lang: 'tr', purpose: 'chat', format: 'pcm16' });
    mockMic.onPcm!(new Uint8Array(3200));
    expect(ws.audioBytes()).toBe(3200);

    await server(() => {
      ws.say({ type: 'final', text: ' merhaba' });
      ws.say({ type: 'partial', text: ' dünya' });
    });
    expect(screen.getByTestId('live-words')).toBeTruthy();
    expect(screen.getByText('Note: merhaba dünya')).toBeTruthy();
    const tail = screen.getByTestId('live-tail');
    expect(tail).toHaveTextContent(' dünya');
    expect(tail).toHaveStyle({ color: colors.inkDim });

    // The server's last words and its whole text, once it hears stop.
    ws.reply = (d) => {
      if (typeof d === 'string' && JSON.parse(d).type === 'stop')
        ws.say({ type: 'done', text: 'Merhaba dünya.', seconds: 2, model: 'small', language: 'tr', reason: 'stop' });
    };
    await fireEvent.press(screen.getByTestId('voice-done'));
    expect(mockMic.stop).toHaveBeenCalled();
    expect(ws.messages().at(-1)).toEqual({ type: 'stop' });
    expect(await screen.findByDisplayValue('Note: Merhaba dünya.')).toBeTruthy();
    expect(screen.queryByTestId('live-words')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
    expect(forgetRecording).toHaveBeenCalledWith(WAV);
  });

  it.each([
    ['busy', (ws: FakeSocket) => (ws.open(), ws.say({ type: 'error', code: 'busy', message: 'busy' }))],
    ['down', (ws: FakeSocket) => (ws.open(), ws.say({ type: 'error', code: 'down', message: 'not running' }))],
    ['an older server without the route', (ws: FakeSocket) => ws.drop()],
  ])('records on and writes it out the old way when live is not offered (%s)', async (_why, refuse) => {
    const { transcribe } = await renderComposer();
    const ws = await dictate();
    await server(() => refuse(ws));
    expect(screen.getByText(NO_LIVE)).toBeTruthy();
    expect(screen.queryByTestId('live-words')).toBeNull();
    expect(screen.getByTestId('recording-bar')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('voice-done'));
    expect(transcribe).toHaveBeenCalledWith(WAV, 'tr', 'chat');
    expect(await screen.findByDisplayValue('Written out after.')).toBeTruthy();
    expect(mockRecorder.record).not.toHaveBeenCalled(); // the one microphone recorded it all
  });

  it('says "not available" once, not at every recording', async () => {
    await renderComposer();
    let ws = await dictate();
    await server(() => ws.drop());
    expect(screen.getByText(NO_LIVE)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('voice-done'));
    await screen.findByDisplayValue('Written out after.');
    ws = await dictate();
    await server(() => ws.drop());
    expect(screen.queryByText(NO_LIVE)).toBeNull();
  });

  it('writes the recording out the old way when the live words break part way', async () => {
    const { transcribe } = await renderComposer();
    const ws = await dictate();
    await server(() => {
      ws.open();
      ws.say({ type: 'ready', model: 'small' });
      ws.say({ type: 'final', text: ' merhaba' });
      ws.say({ type: 'error', code: 'failed', message: 'the service stopped' });
    });
    expect(screen.getByText(LIVE_BROKE)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('voice-done'));
    expect(transcribe).toHaveBeenCalledWith(WAV, 'tr', 'chat');
    expect(await screen.findByDisplayValue('Written out after.')).toBeTruthy();
  });

  it('writes it out the old way when stopped before the server was ready', async () => {
    const { transcribe } = await renderComposer();
    const ws = await dictate();
    await server(() => ws.open());
    await fireEvent.press(screen.getByTestId('voice-done'));
    expect(ws.closed).toBe(true);
    expect(transcribe).toHaveBeenCalledWith(WAV, 'tr', 'chat');
    expect(await screen.findByDisplayValue('Written out after.')).toBeTruthy();
  });

  it('throws it all away on Cancel', async () => {
    const { transcribe } = await renderComposer();
    const ws = await dictate();
    await server(() => {
      ws.open();
      ws.say({ type: 'ready', model: 'small' });
      ws.say({ type: 'final', text: ' merhaba' });
    });
    await fireEvent.press(screen.getByTestId('voice-cancel'));
    expect(ws.closed).toBe(true);
    expect(mockMic.cancel).toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
    expect(await screen.findByTestId('composer-input')).toHaveDisplayValue('');
  });

  it('records with expo-audio, as before, where there is no PCM microphone (Expo Go)', async () => {
    mockMic.available = false;
    const { transcribe } = await renderComposer();
    await dictate();
    expect(FakeSocket.all).toHaveLength(0);
    expect(mockRecorder.record).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('voice-done'));
    expect(transcribe).toHaveBeenCalledWith(
      { uri: 'file:///cache/rec-1.m4a', name: 'voice.m4a', type: 'audio/mp4' },
      'tr',
      'chat',
    );
  });

  it('opens no socket when the words are to appear after recording', async () => {
    await renderComposer('record');
    await dictate();
    expect(openPcmMic).not.toHaveBeenCalled();
    expect(FakeSocket.all).toHaveLength(0);
    expect(mockRecorder.record).toHaveBeenCalled();
  });
});
