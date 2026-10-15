/**
 * Where a line is written: a rounded field at the bottom, sitting on the
 * keyboard, that grows with the text up to six lines. In its row: the
 * microphone (dictate: the recording is transcribed by the server and put in
 * the box to read over) and one round button - Send when there is text,
 * Stop while an answer is written, Voice note otherwise. Nothing is sent
 * until Send is pressed.
 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { tick } from '../lib/feel';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { useVoiceRecorder } from '../voice/useVoiceRecorder';
import { ArrowUp, AudioLines, Mic, Square } from './icons';
import { RecordingBar } from './RecordingBar';
import { ErrorText, Glyph, IconButton } from './ui';

/** The box grows with the text up to this many lines, then scrolls inside. */
export const MAX_LINES = 6;
const PAD_V = 11;
const MIN_H = type.inputLine + PAD_V * 2;
const MAX_H = type.inputLine * MAX_LINES + PAD_V * 2;
/** The round button at the end of the row. */
const ROUND = 36;

export interface ComposerHandle {
  /** Put a line in the box (a suggestion), ready to edit or send. */
  fill: (text: string) => void;
}

export const Composer = forwardRef<
  ComposerHandle,
  {
    client: WorkbenchClient | null;
    lang: VoiceLang;
    writing: boolean;
    onSend: (text: string) => Promise<boolean>;
    onStop: () => void;
    onVoiceNote?: () => void;
  }
>(function Composer({ client, lang, writing, onSend, onStop, onVoiceNote }, ref) {
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

  useImperativeHandle(ref, () => ({
    fill: (t: string) => {
      setText(t);
      setWebHeight(MIN_H);
      input.current?.focus();
    },
  }));

  // The box empties at once; `onSend` resolves only when the answer is
  // written, and a line that could not be sent comes back to the box.
  const send = () => {
    const t = text.trim();
    if (!t) return;
    tick();
    setText('');
    setWebHeight(MIN_H);
    onSend(t).then((ok) => {
      if (!ok) setText((now) => now || t);
    });
  };

  if (voice.phase !== 'idle') {
    return (
      <View style={s.wrap}>
        <View style={[s.field, s.recording]}>
          <View style={s.flex}>
            <RecordingBar phase={voice.phase} elapsed={voice.elapsed} onCancel={voice.cancel} onDone={voice.finish} />
          </View>
        </View>
      </View>
    );
  }

  const has = !!text.trim();
  const round = has
    ? { id: 'send', label: 'Send', icon: ArrowUp, on: true, press: send }
    : writing
      ? { id: 'stop', label: 'Stop the answer', icon: Square, on: true, press: onStop }
      : onVoiceNote
        ? { id: 'open-voice-note', label: 'Record a voice note', icon: AudioLines, on: true, press: onVoiceNote }
        : { id: 'send', label: 'Send', icon: ArrowUp, on: false, press: send };

  return (
    <View style={s.wrap}>
      {voice.error ? (
        <View style={s.error}>
          <ErrorText>{voice.error}</ErrorText>
        </View>
      ) : null}
      <View style={[s.field, focused && s.focused]}>
        <TextInput
          ref={input}
          testID="composer-input"
          style={[s.input, Platform.OS === 'web' && { height: webHeight }]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          value={text}
          onChangeText={(t) => {
            if (Platform.OS === 'web' && t.length < text.length) setWebHeight(MIN_H);
            setText(t);
            if (voice.error) voice.setError(null);
          }}
          placeholder="Message"
          placeholderTextColor={colors.inkDim}
          selectionColor={colors.inkDim}
          accessibilityLabel="Message"
          onContentSizeChange={
            Platform.OS === 'web'
              ? // A textarea never shrinks by itself, so taking text out starts it again from one line.
                (e) => setWebHeight(Math.min(MAX_H, Math.max(MIN_H, Math.ceil(e.nativeEvent.contentSize.height))))
              : undefined
          }
          multiline
          scrollEnabled
          textAlignVertical="top"
          autoCapitalize="sentences"
          enterKeyHint="enter"
        />
        <View style={s.tools}>
          <IconButton
            icon={Mic}
            label="Dictate a message"
            onPress={voice.start}
            testID="voice-start"
            size={20}
            color={colors.inkDim}
            style={s.mic}
          />
          <Pressable
            testID={round.id}
            onPress={round.press}
            disabled={!round.on}
            accessibilityRole="button"
            accessibilityLabel={round.label}
            accessibilityState={{ disabled: !round.on }}
            hitSlop={6}
            style={({ pressed }) => [s.round, !round.on && s.roundOff, pressed && s.roundPressed]}
          >
            <Glyph
              icon={round.icon}
              size={round.icon === Square ? 14 : 20}
              color={round.on ? colors.inkOnAccent : colors.inkDim}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.sm, gap: 6 },
  error: { paddingHorizontal: space.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: radius.field,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  // Focus is told by the hairline getting lighter (the browser's own ring is off on the web).
  focused: { borderColor: colors.pressed },
  recording: { paddingLeft: 10, paddingVertical: 2 },
  flex: { flex: 1 },
  input: {
    flex: 1,
    minHeight: MIN_H,
    maxHeight: MAX_H,
    paddingHorizontal: 10,
    paddingTop: PAD_V,
    paddingBottom: PAD_V,
    fontFamily: fonts.sans,
    fontSize: type.input,
    lineHeight: type.inputLine,
    color: colors.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  tools: { flexDirection: 'row', alignItems: 'center', height: MIN_H, gap: 2 },
  mic: { width: 40, height: 40 },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  roundOff: { backgroundColor: colors.hover },
  roundPressed: { opacity: 0.75 },
});
