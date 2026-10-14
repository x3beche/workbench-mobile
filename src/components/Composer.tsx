/**
 * Where a line is written: by keyboard, or by voice - the recording is
 * transcribed by the server and put in the box to read over. Nothing is sent
 * until Send is pressed.
 */
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { colors, fonts, radius, type } from '../theme/tokens';
import { useVoiceRecorder } from '../voice/useVoiceRecorder';
import { RecordingBar } from './RecordingBar';
import { Button, ErrorText } from './ui';

export function Composer({
  client,
  lang,
  writing,
  onSend,
  onStop,
}: {
  client: WorkbenchClient | null;
  lang: VoiceLang;
  writing: boolean;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const voice = useVoiceRecorder(client, lang, 'chat', (got) => {
    if (!got) return;
    setText((now) => (now.trim() ? `${now.trimEnd()} ${got}` : got));
    input.current?.focus();
  });

  // The box empties at once; `onSend` resolves only when the answer is
  // written, and a line that could not be sent comes back to the box.
  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    onSend(t).then((ok) => {
      if (!ok) setText((now) => now || t);
    });
  };

  if (voice.phase !== 'idle') {
    return (
      <View style={s.wrap}>
        <RecordingBar phase={voice.phase} elapsed={voice.elapsed} onCancel={voice.cancel} onDone={voice.finish} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {voice.error ? <ErrorText>{voice.error}</ErrorText> : null}
      <TextInput
        ref={input}
        testID="composer-input"
        style={s.input}
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (voice.error) voice.setError(null);
        }}
        placeholder="Write a message"
        placeholderTextColor={colors.inkDim}
        selectionColor={colors.inkDim}
        accessibilityLabel="Message"
        multiline
        textAlignVertical="top"
      />
      <View style={s.row}>
        <Button label="Voice" variant="quiet" onPress={voice.start} testID="voice-start" accessibilityLabel="Record a voice message" />
        <View style={s.flex} />
        {writing ? <Button label="Stop" onPress={onStop} testID="stop" accessibilityLabel="Stop the answer" /> : null}
        <Button label="Send" variant="primary" onPress={send} disabled={!text.trim()} testID="send" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 44,
    maxHeight: 160,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fonts.sans,
    fontSize: type.body,
    lineHeight: 21,
    color: colors.ink,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
