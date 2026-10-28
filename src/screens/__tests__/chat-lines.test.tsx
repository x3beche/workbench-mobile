/**
 * How the Chat draws its lines: the app's own reading of a conversation, the
 * same as the web's simple view. An answer's work - its thinking and its tool
 * calls - is one line under it, opened by a tap, and the line says what was
 * done in the app's language. The model's name and the figures under it are the
 * web's detailed view, drawn where there is room for them, and not here.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Chat } from '../../api/types';
import { ChatScreen } from '../ChatScreen';

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

const ANSWER = 'The rail sags.';
const THINKING = 'Look at the regulator before the rail.';

/** A fresh chat each time: the screen lays its own state over the one it is given. */
const mockChat = () =>
  ({
    id: 'c1',
    title: 'Rail sag',
    model: 'm',
    provider: 'p',
    messages: [
      { id: 'q1', role: 'user', content: 'Why does the rail sag?', at: '2026-10-15T10:00:00Z', by: { id: 'u1' } },
      {
        id: 'a1',
        role: 'assistant',
        content: ANSWER,
        at: '2026-10-15T10:00:10Z',
        model: 'deepseek/deepseek-v4',
        thinking: THINKING,
        thinking_ms: 8900,
        steps: [
          {
            id: 'st1',
            tool: 'read',
            status: 'done',
            say: 'Reading {name}',
            vars: { name: 'rail.step' },
            summary: 'U3 LDO',
          },
        ],
      },
    ],
  }) as unknown as Chat;

jest.mock('../../state/session', () => {
  const session = () => ({
    client: { getChat: jest.fn(async () => mockChat()), live: jest.fn(async () => undefined), say: jest.fn() },
    user: { id: 'u1', name: 'Ada' },
    account: { id: 'a1' },
  });
  return { useSession: session, useMaybeSession: session };
});

const open = (lang: 'en' | 'tr' = 'en') => render(<ChatScreen initial={mockChat()} lang={lang} />);

describe('a line of the Chat', () => {
  it('puts the thinking and the tool calls behind one line, opened by a tap', async () => {
    await open();
    // The line says what was done, and the answer itself is as written.
    expect(screen.getByText('1 tool call · thought 8.9 s')).toBeTruthy();
    expect(screen.getByText(ANSWER)).toBeTruthy();
    // Nothing of the work is out until it is opened.
    expect(screen.queryByText(THINKING)).toBeNull();
    expect(screen.queryByText('Reading rail.step')).toBeNull();
    await fireEvent.press(screen.getByTestId('compact-work'));
    expect(screen.getByText(THINKING)).toBeTruthy();
    expect(screen.getByText('Reading rail.step')).toBeTruthy();
    // Opened, the row's own body is out too.
    expect(screen.getByText('U3 LDO')).toBeTruthy();
  });

  it("says the folded line in the app's language", async () => {
    await open('tr');
    expect(screen.getByText('1 araç çağrısı · düşündü 8.9 s')).toBeTruthy();
  });

  it('draws no model name over the answer and no figures under it', async () => {
    await open();
    expect(screen.queryByText(/deepseek-v4/)).toBeNull();
    expect(screen.queryByText(/tokens/)).toBeNull();
  });
});
