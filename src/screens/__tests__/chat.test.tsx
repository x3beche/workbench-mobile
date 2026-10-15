import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';

import type { Chat } from '../../api/types';
import { ChatScreen, END_SLACK } from '../ChatScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
// The spacer follows the native keyboard frame; there is none here.
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));

const lines = Array.from({ length: 30 }, (_, i) => ({
  id: `m${i}`,
  role: i % 2 ? 'assistant' : 'user',
  content: `Line ${i}`,
  at: '2026-10-15T10:00:00Z',
}));
const chat = { id: 'c1', title: 'Rail sag', model: 'm', provider: 'p', messages: lines } as unknown as Chat;

const mockClient = {
  getChat: jest.fn(async () => chat),
  live: jest.fn(async () => undefined),
  say: jest.fn(async () => ({ queued: false })),
};
jest.mock('../../state/session', () => ({
  useSession: () => ({ client: mockClient, user: { id: 'u1', name: 'Ada' } }),
}));

/** A scroll event as the list reports it: 2000 px of content in a 600 px window. */
function scrollTo(y: number) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { width: 390, height: 2000 },
      layoutMeasurement: { width: 390, height: 600 },
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('chat screen', () => {
  it('follows the end, offers a way back after scrolling up, and goes back to the end', async () => {
    await render(<ChatScreen initial={chat} onBack={jest.fn()} lang="auto" />);
    const list = screen.getByTestId('chat-list');
    const toEnd = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => undefined);

    // At the end: content growing (an answer being written) keeps following.
    await fireEvent.scroll(list, scrollTo(1400));
    await fireEvent(list, 'contentSizeChange', 390, 2100);
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(toEnd).toHaveBeenCalled();
    expect(screen.queryByTestId('jump-to-latest')).toBeNull();

    // Scrolled up to read: the list stays put and offers the way back.
    toEnd.mockClear();
    await fireEvent.scroll(list, scrollTo(600));
    expect(screen.getByTestId('jump-to-latest')).toBeTruthy();
    await fireEvent(list, 'contentSizeChange', 390, 2200);
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(toEnd).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('jump-to-latest'));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(toEnd).toHaveBeenCalledWith({ animated: true });
    expect(screen.queryByTestId('jump-to-latest')).toBeNull();
    toEnd.mockRestore();
  });

  it('counts as at the end within the slack, and sending goes back to the end', async () => {
    await render(<ChatScreen initial={chat} onBack={jest.fn()} lang="auto" />);
    const list = screen.getByTestId('chat-list');
    const toEnd = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => undefined);
    await fireEvent.scroll(list, scrollTo(1400));
    await fireEvent.scroll(list, scrollTo(1400 - END_SLACK + 1));
    expect(screen.queryByTestId('jump-to-latest')).toBeNull();

    await fireEvent.scroll(list, scrollTo(300));
    expect(screen.getByTestId('jump-to-latest')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Next question');
    await fireEvent.press(screen.getByTestId('send'));
    expect(screen.queryByTestId('jump-to-latest')).toBeNull();
    expect(mockClient.say).toHaveBeenCalled();
    toEnd.mockRestore();
  });
});
