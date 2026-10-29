/**
 * A voice note: record, read the transcript over (and fix it), send it to
 * the conversation. The transcript is never sent without that look.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { colors, fonts, gutter, motion, radius, type } from '../theme/tokens';
import { useVoiceRecorder } from '../voice/useVoiceRecorder';
import { langLabel, type VoiceMode } from '../voice/voice';
import { Appear } from './Appear';
import { KeyboardSpacer } from './KeyboardSpacer';
import { LiveWords } from './LiveWords';
import { RecordingBar } from './RecordingBar';
import { Button, ErrorText, Hint } from './ui';

/** Mount it to open it: it starts recording at once. */
export function VoiceNoteSheet({
  client,
  lang,
  mode = 'record',
  onClose,
  onSend,
}: {
  client: WorkbenchClient | null;
  lang: VoiceLang;
  /** Live: the words show while they are spoken, then stay to be read over. */
  mode?: VoiceMode;
  onClose: () => void;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState<string | null>(null);
  const voice = useVoiceRecorder(client, lang, 'note', (got) => setText(got ?? ''), mode);
  const { start, cancel, phase, finish } = voice;

  // Opening the sheet is asking to record.
  useEffect(() => {
    start();
  }, [start]);

  const close = async () => {
    if (phase === 'recording') await cancel();
    onClose();
  };

  // Sent into the conversation, which follows the answer. The sheet waits for
  // the send: a line that did not go stays here with its words, to try again.
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const send = async () => {
    const t = text?.trim();
    if (!t || sending) return;
    setSending(true);
    setFailed(null);
    try {
      if (await onSend(t)) onClose();
      else setFailed('The note did not go. It is still here - try again.');
    } catch (e) {
      setFailed((e as Error).message || 'The note did not go. It is still here - try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Pressable style={s.scrim} onPress={close} accessibilityLabel="Close" />
      <Appear from="below" fill={false} duration={motion.sheet}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>Voice note</Text>
            <Text style={s.lang}>{langLabel(lang)}</Text>
          </View>
          {voice.error ? <ErrorText>{voice.error}</ErrorText> : voice.notice ? <Hint>{voice.notice}</Hint> : null}
          {phase !== 'idle' && voice.live ? (
            <View style={s.live}>
              <LiveWords words={voice.live} lines={8} />
            </View>
          ) : null}
          {phase !== 'idle' ? (
            <RecordingBar phase={phase} elapsed={voice.elapsed} onCancel={close} onDone={finish} doneLabel="Stop" />
          ) : text !== null ? (
            <>
              <TextInput
                testID="voice-note-text"
                style={s.input}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Transcript"
                placeholder="Nothing was heard"
                placeholderTextColor={colors.inkDim}
                selectionColor={colors.inkDim}
              />
              <Hint>Read it over and correct it before sending.</Hint>
              {failed ? <ErrorText>{failed}</ErrorText> : null}
              <View style={s.row}>
                <Button label="Discard" variant="quiet" onPress={close} />
                <Button
                  label="Record again"
                  onPress={() => {
                    setText(null);
                    start();
                  }}
                />
                <Button
                  label="Send"
                  variant="primary"
                  disabled={!text.trim()}
                  busy={sending}
                  onPress={send}
                  testID="voice-note-send"
                />
              </View>
            </>
          ) : (
            <View style={s.row}>
              <Button label="Close" variant="quiet" onPress={close} />
              <Button label="Try again" onPress={start} />
            </View>
          )}
          <KeyboardSpacer />
        </SafeAreaView>
      </Appear>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: gutter,
    paddingTop: gutter,
    paddingBottom: 8,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  // As the transcript's box below, so the words stay where they are when it takes them.
  live: {
    minHeight: 110,
    paddingHorizontal: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  lang: { fontFamily: fonts.mono, fontSize: type.tiny, color: colors.inkDim },
  input: {
    minHeight: 110,
    maxHeight: 260,
    padding: 12,
    fontFamily: fonts.sans,
    fontSize: type.input,
    lineHeight: type.inputLine,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
});
