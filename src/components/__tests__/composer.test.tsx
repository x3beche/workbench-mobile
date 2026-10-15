import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import { PERMISSION_DENIED } from '../../voice/voice';
import { Composer } from '../Composer';

const mockAudio = {
  granted: true,
  recorder: {
    uri: 'file:///cache/rec-1.m4a' as string | null,
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
  },
};

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a', sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 } },
  requestRecordingPermissionsAsync: jest.fn(async () => ({
    granted: mockAudio.granted,
    status: mockAudio.granted ? 'granted' : 'denied',
  })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => mockAudio.recorder,
}));

function fakeClient(transcribe: jest.Mock) {
  return { transcribe } as unknown as WorkbenchClient;
}

async function renderComposer(
  transcribe = jest.fn(async () => ({ text: 'Merhaba dünya', language: 'tr', model: 'w', seconds: 2 })),
) {
  const onSend = jest.fn(async () => true);
  const onStop = jest.fn();
  await render(<Composer client={fakeClient(transcribe)} lang="tr" writing={false} onSend={onSend} onStop={onStop} />);
  return { transcribe, onSend, onStop };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockAudio.granted = true;
  mockAudio.recorder.uri = 'file:///cache/rec-1.m4a';
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Composer', () => {
  it('sends what was typed and clears the box', async () => {
    const { onSend } = await renderComposer();
    await fireEvent.changeText(screen.getByTestId('composer-input'), '  How are gears cut?  ');
    await fireEvent.press(screen.getByTestId('send'));
    expect(onSend).toHaveBeenCalledWith('How are gears cut?');
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('');
  });

  it('shows Stop while an answer is being written', async () => {
    const onStop = jest.fn();
    await render(<Composer client={null} lang="auto" writing onSend={jest.fn(async () => true)} onStop={onStop} />);
    await fireEvent.press(screen.getByTestId('stop'));
    expect(onStop).toHaveBeenCalled();
  });

  it('says how to allow the microphone when it is refused', async () => {
    mockAudio.granted = false;
    await renderComposer();
    await fireEvent.press(screen.getByTestId('voice-start'));
    expect(await screen.findByText(PERMISSION_DENIED)).toBeTruthy();
    expect(screen.queryByTestId('recording-bar')).toBeNull();
    expect(mockAudio.recorder.record).not.toHaveBeenCalled();
  });

  it('records with a timer, transcribes on Done, and puts the text in the box without sending', async () => {
    const { transcribe, onSend } = await renderComposer();
    await fireEvent.press(screen.getByTestId('voice-start'));
    expect(await screen.findByTestId('recording-bar')).toBeTruthy();
    expect(mockAudio.recorder.record).toHaveBeenCalled();
    expect(screen.getByText('0:00')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3_100);
    });
    expect(screen.getByText('0:03')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('voice-done'));
    expect(mockAudio.recorder.stop).toHaveBeenCalled();
    expect(transcribe).toHaveBeenCalledWith(
      { uri: 'file:///cache/rec-1.m4a', name: 'voice.m4a', type: 'audio/mp4' },
      'tr',
      'chat',
    );
    expect(await screen.findByDisplayValue('Merhaba dünya')).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('adds the transcript after text already typed', async () => {
    await renderComposer();
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Note:');
    await fireEvent.press(screen.getByTestId('voice-start'));
    await fireEvent.press(await screen.findByTestId('voice-done'));
    expect(await screen.findByDisplayValue('Note: Merhaba dünya')).toBeTruthy();
  });

  it('drops the recording on Cancel', async () => {
    const { transcribe } = await renderComposer();
    await fireEvent.press(screen.getByTestId('voice-start'));
    await fireEvent.press(await screen.findByTestId('voice-cancel'));
    expect(await screen.findByTestId('composer-input')).toHaveDisplayValue('');
    expect(mockAudio.recorder.stop).toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("shows the server's reason when transcribing fails", async () => {
    const { ApiError } = jest.requireActual('../../api/client');
    const transcribe = jest.fn(async () => {
      throw new ApiError(503, 'voice is not configured on this server');
    });
    await renderComposer(transcribe);
    await fireEvent.press(screen.getByTestId('voice-start'));
    await fireEvent.press(await screen.findByTestId('voice-done'));
    expect(await screen.findByText('voice is not configured on this server')).toBeTruthy();
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('');
  });

  it('stops by itself at the length limit and still fills the box', async () => {
    const { transcribe } = await renderComposer();
    await fireEvent.press(screen.getByTestId('voice-start'));
    await screen.findByTestId('recording-bar');
    await act(async () => {
      jest.advanceTimersByTime(296_000);
    });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(await screen.findByDisplayValue('Merhaba dünya')).toBeTruthy();
  });
});

describe('Composer box', () => {
  it('is readable while typing: 16 px text, growing to six lines and scrolling after', async () => {
    const { StyleSheet } = jest.requireActual('react-native');
    const { MAX_LINES } = jest.requireActual('../Composer');
    await renderComposer();
    const style = StyleSheet.flatten(screen.getByTestId('composer-input').props.style);
    expect(style.fontSize).toBeGreaterThanOrEqual(16);
    expect(MAX_LINES).toBe(6);
    expect(style.maxHeight).toBe(style.lineHeight * MAX_LINES + style.paddingTop + style.paddingBottom);
    expect(screen.getByTestId('composer-input').props.multiline).toBe(true);
  });
});
