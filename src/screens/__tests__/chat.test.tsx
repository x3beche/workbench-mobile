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
    await render(<ChatScreen initial={chat} lang="auto" />);
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
    await render(<ChatScreen initial={chat} lang="auto" />);
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

describe('lines', () => {
  const answer = {
    id: 'a1',
    role: 'assistant',
    model: 'anthropic/claude-sonnet-4.5',
    at: '2026-10-15T10:00:00Z',
    content: 'Before.\n\n```c\nint x = 1;\n```\n\nAfter.',
    steps: [
      {
        id: 's1',
        tool: 'read_board',
        status: 'done',
        pos: 0,
        say: 'Reading {name}',
        vars: { name: 'Sensor board' },
        summary: '42 parts',
      },
      {
        id: 's2',
        tool: 'part_search',
        status: 'error',
        pos: 8,
        say: 'Looking up {q}',
        vars: { q: 'FB2' },
        error: 'offline',
      },
    ],
  };
  const withAnswer = { ...chat, messages: [lines[0], answer] } as unknown as Chat;

  beforeEach(() => {
    mockClient.getChat.mockResolvedValue(withAnswer);
  });
  afterEach(() => {
    mockClient.getChat.mockResolvedValue(chat);
  });

  it('shows the tools an answer ran where they ran, each opening to what it found', async () => {
    await render(<ChatScreen initial={withAnswer} lang="auto" />);
    expect(screen.getByText('Reading Sensor board')).toBeTruthy();
    expect(screen.getByText('Looking up FB2')).toBeTruthy();
    expect(screen.queryByText('42 parts')).toBeNull();
    await fireEvent.press(screen.getByTestId('step-s1'));
    expect(screen.getByText('42 parts')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('step-s2'));
    expect(screen.getByText('offline')).toBeTruthy();
    // The model's name, short, above the answer.
    expect(screen.getByText('claude-sonnet-4.5')).toBeTruthy();
  });

  it('copies a code block, and a whole line from its long-press menu', async () => {
    const Clipboard = jest.requireMock('expo-clipboard');
    await render(<ChatScreen initial={withAnswer} lang="auto" />);
    await fireEvent.press(screen.getByTestId('copy-code'));
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('int x = 1;');
    expect(await screen.findByText('Copied')).toBeTruthy();

    await fireEvent(screen.getByText('After.'), 'longPress');
    await fireEvent.press(screen.getByTestId('action-copy'));
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(answer.content);

    await fireEvent(screen.getByText('Line 0'), 'longPress');
    await fireEvent.press(screen.getByTestId('action-select'));
    expect(screen.getByTestId('select-done')).toBeTruthy();
  });

  it('shows the line at once and three dots until the first words come', async () => {
    let feed: ((ev: object) => void) | null = null;
    (mockClient.say as jest.Mock).mockImplementationOnce(
      (_id: string, _body: object, h: { onEvent: (ev: object) => void }) =>
        new Promise(() => {
          feed = h.onEvent;
        }),
    );
    await render(<ChatScreen initial={withAnswer} lang="auto" />);
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'And the layout?');
    await fireEvent.press(screen.getByTestId('send'));
    expect(screen.getByTestId('pending-line')).toBeTruthy();
    await act(async () => {
      feed!({
        type: 'user',
        gen: 'g1',
        keep: 2,
        message: { id: 'u9', role: 'user', content: 'And the layout?', at: '' },
      });
    });
    expect(screen.queryByTestId('pending-line')).toBeNull();
    expect(screen.getByTestId('typing')).toBeTruthy();
    await act(async () => {
      feed!({ type: 'text', gen: 'g1', text: 'Keep it short.', at: 0 });
    });
    expect(screen.queryByTestId('typing')).toBeNull();
    expect(screen.getByText('Keep it short.')).toBeTruthy();
  });
});
