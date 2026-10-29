/**
 * A line written and not sent is the person's work: it comes back to the box
 * when the conversation is opened again, is cleared when it goes, and is put
 * back above anything typed since when the send fails.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { readDraft, setDraftScope } from '../../lib/drafts';
import { Composer } from '../Composer';

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));

beforeEach(() => {
  setDraftScope('account-1');
});

function box(key: string, onSend = jest.fn(async () => true)) {
  return render(
    <Composer client={null} lang="auto" writing={false} onSend={onSend} onStop={jest.fn()} draftKey={key} />,
  );
}

describe('a draft', () => {
  it('comes back when the same conversation is opened again', async () => {
    const first = await box('chat:abc');
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Half a question');
    await first.unmount();

    await box('chat:abc');
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('Half a question');
  });

  it('stays with its own conversation', async () => {
    const first = await box('chat:abc');
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'For abc');
    await first.unmount();

    await box('chat:xyz');
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('');
  });

  it('is gone once it is sent', async () => {
    const first = await box('chat:abc');
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Send me');
    await fireEvent.press(screen.getByTestId('send'));
    await first.unmount();

    await box('chat:abc');
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('');
  });

  it('comes back to the box when the send fails, and is kept', async () => {
    const onSend = jest.fn(async () => false);
    const seen = await box('chat:abc', onSend);
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'The first line');
    await fireEvent.press(screen.getByTestId('send'));
    await screen.findByDisplayValue('The first line');
    expect(onSend).toHaveBeenCalledWith('The first line');
    await seen.unmount();

    await box('chat:abc');
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('The first line');
  });

  it('follows a new conversation once it has an id', async () => {
    const seen = await box('chat:new');
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Still writing');
    seen.rerender(
      <Composer client={null} lang="auto" writing={false} onSend={jest.fn(async () => true)} onStop={jest.fn()} draftKey="chat:made" />,
    );
    await act(async () => undefined);
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue('Still writing');
    // Kept under the conversation's own id from now on: leaving and coming back finds it.
    expect(readDraft('chat:made')).toBe('Still writing');
  });
});
