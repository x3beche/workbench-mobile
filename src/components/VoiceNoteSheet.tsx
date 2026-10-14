/**
 * A voice note: record, read the transcript over (and fix it), send it to
 * the conversation. The transcript is never sent without that look.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { colors, fonts, radius, type } from '../theme/tokens';
import { useVoiceRecorder } from '../voice/useVoiceRecorder';
import { langLabel } from '../voice/voice';
import { RecordingBar } from './RecordingBar';
import { Button, ErrorText, Hint } from './ui';

/** Mount it to open it: it starts recording at once. */
export function VoiceNoteSheet({
  client,
  lang,
  onClose,
  onSend,
}: {
  client: WorkbenchClient | null;
  lang: VoiceLang;
  onClose: () => void;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const voice = useVoiceRecorder(client, lang, 'note', (got) => setText(got ?? ''));
  const { start, cancel, phase, finish } = voice;

  // Opening the sheet is asking to record.
  useEffect(() => {
    start();
  }, [start]);

  const close = async () => {
    if (phase === 'recording') await cancel();
    onClose();
  };

  const send = async () => {
    if (!text?.trim()) return;
    setSending(true);
    const ok = await onSend(text.trim());
    setSending(false);
    if (ok) onClose();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Pressable style={s.scrim} onPress={close} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>Voice note</Text>
            <Text style={s.lang}>{langLabel(lang)}</Text>
          </View>
          {voice.error ? <ErrorText>{voice.error}</ErrorText> : null}
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
              <View style={s.row}>
                <Button label="Discard" variant="quiet" onPress={close} />
                <Button label="Record again" onPress={() => { setText(null); start(); }} />
                <Button label="Send" variant="primary" busy={sending} disabled={!text.trim()} onPress={send} testID="voice-note-send" />
              </View>
            </>
          ) : (
            <View style={s.row}>
              <Button label="Close" variant="quiet" onPress={close} />
              <Button label="Try again" onPress={start} />
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: 16,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  lang: { fontFamily: fonts.mono, fontSize: type.tiny, color: colors.inkDim },
  input: {
    minHeight: 110,
    maxHeight: 260,
    padding: 12,
    fontFamily: fonts.sans,
    fontSize: type.body,
    lineHeight: 21,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
