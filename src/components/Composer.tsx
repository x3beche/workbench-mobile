/**
 * Where a line is written: by keyboard, or by voice - the recording is
 * transcribed by the server and put in the box to read over. Nothing is sent
 * until Send is pressed.
 */
import { useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { colors, fonts, gutter, radius, space, type } from '../theme/tokens';
import { useVoiceRecorder } from '../voice/useVoiceRecorder';
import { RecordingBar } from './RecordingBar';
import { Button, ErrorText } from './ui';

/** The box grows with the text up to this many lines, then scrolls inside. */
export const MAX_LINES = 6;
const PAD_V = 12;
const MIN_H = type.inputLine + PAD_V * 2;
const MAX_H = type.inputLine * MAX_LINES + PAD_V * 2;

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
  // Native multiline inputs grow by themselves between min and max height;
  // the web's textarea does not, so there its content height is followed.
  const [webHeight, setWebHeight] = useState(MIN_H);
  const [focused, setFocused] = useState(false);
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
    setWebHeight(MIN_H);
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
        style={[s.input, focused && s.focused, Platform.OS === 'web' && { height: webHeight }]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={text}
        onChangeText={(t) => {
          if (Platform.OS === 'web' && t.length < text.length) setWebHeight(MIN_H);
          setText(t);
          if (voice.error) voice.setError(null);
        }}
        placeholder="Write a message"
        placeholderTextColor={colors.inkDim}
        selectionColor={colors.inkDim}
        accessibilityLabel="Message"
        onContentSizeChange={
          Platform.OS === 'web'
            ? // The textarea's scroll height leaves out its 1 px borders; a box
              // never shrinks by itself, so taking text out starts it again from one line.
              (e) => setWebHeight(Math.min(MAX_H, Math.max(MIN_H, Math.ceil(e.nativeEvent.contentSize.height) + 2)))
            : undefined
        }
        multiline
        scrollEnabled
        textAlignVertical="top"
        autoCapitalize="sentences"
        enterKeyHint="enter"
      />
      <View style={s.row}>
        <Button
          label="Voice"
          variant="quiet"
          onPress={voice.start}
          testID="voice-start"
          accessibilityLabel="Record a voice message"
        />
        <View style={s.flex} />
        {writing ? <Button label="Stop" onPress={onStop} testID="stop" accessibilityLabel="Stop the answer" /> : null}
        <Button label="Send" variant="primary" onPress={send} disabled={!text.trim()} testID="send" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: space.sm,
    paddingHorizontal: gutter - space.xs,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: MIN_H,
    maxHeight: MAX_H,
    paddingHorizontal: 12,
    paddingTop: PAD_V,
    paddingBottom: PAD_V,
    fontFamily: fonts.sans,
    fontSize: type.input,
    lineHeight: type.inputLine,
    color: colors.ink,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  // Focus is told by the hairline getting lighter (the browser's own ring is off on the web).
  focused: { borderColor: colors.inkDim, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
