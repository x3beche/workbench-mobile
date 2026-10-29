/**
 * Where a line is written: a rounded field at the bottom, sitting on the
 * keyboard, that grows with the text up to six lines. In its row: the
 * microphone (dictate: the recording is transcribed by the server and put in
 * the box to read over) and one round button - Send when there is text,
 * Stop while an answer is written, Voice note otherwise. Nothing is sent
 * until Send is pressed. With live voice to text the words come into the box
 * while they are spoken - settled ones in ink, the unsure tail dimmed - and
 * stay there, when it is stopped, to read over like any other.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { readDraft, writeDraft } from '../lib/drafts';
import { tick } from '../lib/feel';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { joinWords } from '../voice/live';
import { useVoiceRecorder } from '../voice/useVoiceRecorder';
import type { VoiceMode } from '../voice/voice';
import { ArrowUp, AudioLines, Mic, Square } from './icons';
import { LiveWords } from './LiveWords';
import { RecordingBar } from './RecordingBar';
import { ErrorText, Glyph, Hint, IconButton } from './ui';

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
    /** When the dictated words appear: while speaking (where the server offers it) or after. */
    mode?: VoiceMode;
    writing: boolean;
    onSend: (text: string) => Promise<boolean>;
    onStop: () => void;
    onVoiceNote?: () => void;
    /** The box's empty words (else "Message"). */
    placeholder?: string;
    /** Above the box: what goes with the line (a Claude session's pictures). */
    above?: ReactNode;
    /** In the box's row, before the microphone (the paperclip). */
    tool?: ReactNode;
    /** Something goes with the line already: Send works with no words. */
    ready?: boolean;
    /** What to type next, offered in the empty box (dim, italic) with a chip
     *  that puts it in (Claude Code's own suggestion; phones have no Tab).
     *  Gone once something is typed or sent, until another comes. */
    suggestion?: { text: string; use: string } | null;
    /** Which conversation the box is writing to: its text is kept there while
     *  the app runs, so a screen drawn afresh (another conversation, a session
     *  that ended) brings the draft back (lib/drafts). */
    draftKey?: string;
  }
>(function Composer(
  { client, lang, mode = 'record', writing, onSend, onStop, onVoiceNote, placeholder = 'Message', above, tool, ready = false, suggestion = null, draftKey },
  ref,
) {
  // Read from the conversation's kept draft: coming back to it finds the text.
  const [text, setBox] = useState(() => (draftKey ? readDraft(draftKey) : ''));
  /** Every way the text changes writes it to the conversation's draft. */
  const setText = (next: string | ((now: string) => string)) => {
    setBox((now) => {
      const v = typeof next === 'function' ? next(now) : next;
      if (draftKey) writeDraft(draftKey, v);
      return v;
    });
  };
  // A new conversation takes the box's text with it (its first line makes it
  // a conversation, and the draft belongs to it from then on).
  const keyWas = useRef(draftKey);
  useEffect(() => {
    if (keyWas.current === draftKey) return;
    keyWas.current = draftKey;
    if (draftKey) writeDraft(draftKey, text);
    // The text is the same box, only kept elsewhere now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  // Native multiline inputs grow by themselves between min and max height;
  // the web's textarea does not, so there its content height is followed.
  const [webHeight, setWebHeight] = useState(MIN_H);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  // The suggestion put away by typing or sending, until the server has another.
  const [dropped, setDropped] = useState<string | null>(null);
  const offer = suggestion && suggestion.text !== dropped && !text ? suggestion : null;
  const voice = useVoiceRecorder(
    client,
    lang,
    'chat',
    (got) => {
      if (!got) return;
      setText((now) => joinWords(now.trimEnd(), got));
      input.current?.focus();
    },
    mode,
  );

  useImperativeHandle(ref, () => ({
    fill: (t: string) => {
      setText(t);
      setWebHeight(MIN_H);
      input.current?.focus();
    },
  }));

  // The box empties at once; `onSend` resolves only when the answer is
  // written, and a line that could not be sent comes back to the box - above
  // whatever was typed since, so neither line is lost.
  const sending = useRef(false);
  const send = () => {
    const t = text.trim();
    if (!t && !ready) return;
    if (sending.current) return;
    tick();
    if (suggestion) setDropped(suggestion.text);
    setText('');
    setWebHeight(MIN_H);
    sending.current = true;
    onSend(t)
      .then(
        (ok) => ok,
        () => false,
      )
      .then((ok) => {
        sending.current = false;
        if (!ok) setText((now) => (now ? `${t}\n\n${now}` : t));
      });
  };

  const notice = voice.notice ? (
    <View style={s.error}>
      <Hint>{voice.notice}</Hint>
    </View>
  ) : null;

  if (voice.phase !== 'idle') {
    return (
      <View style={s.wrap}>
        {notice}
        <View style={[s.field, s.recording, voice.live && s.liveField]}>
          {voice.live ? <LiveWords base={text.trim()} words={voice.live} lines={MAX_LINES} /> : null}
          <View style={voice.live ? s.liveBar : s.flex}>
            <RecordingBar phase={voice.phase} elapsed={voice.elapsed} onCancel={voice.cancel} onDone={voice.finish} />
          </View>
        </View>
      </View>
    );
  }

  const has = !!text.trim() || ready;
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
      ) : (
        notice
      )}
      {above}
      <View style={[s.field, focused && s.focused]}>
        <TextInput
          ref={input}
          testID="composer-input"
          style={[s.input, offer && s.suggested, Platform.OS === 'web' && { height: webHeight }]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          value={text}
          onChangeText={(t) => {
            if (Platform.OS === 'web' && t.length < text.length) setWebHeight(MIN_H);
            setText(t);
            if (t && suggestion) setDropped(suggestion.text);
            if (voice.error) voice.setError(null);
            if (voice.notice) voice.setNotice(null);
          }}
          placeholder={offer ? offer.text : placeholder}
          placeholderTextColor={colors.inkDim}
          selectionColor={colors.inkDim}
          accessibilityLabel={placeholder}
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
          {offer ? (
            <Pressable
              onPress={() => {
                setText(offer.text);
                input.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${offer.use}: ${offer.text}`}
              hitSlop={6}
              style={({ pressed }) => [s.use, pressed && s.usePressed]}
              testID="composer-use-suggestion"
            >
              <Text style={s.useText}>{offer.use}</Text>
            </Pressable>
          ) : null}
          {tool}
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
    borderColor: colors.lineStrong,
  },
  // Focus is told by the border turning to the accent: the browser's own ring is
  // off on the web, so this is the ring - and it is a colour you can see.
  focused: { borderColor: colors.focus },
  recording: { paddingLeft: 10, paddingVertical: 2 },
  // Live words: the text above, the recording's row under it, in the one box.
  liveField: { flexDirection: 'column', alignItems: 'stretch', paddingLeft: 6 },
  liveBar: { paddingLeft: 4 },
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
  // The suggestion in the empty box: dim and italic, as in Claude Code's terminal.
  suggested: { fontStyle: 'italic' },
  use: {
    height: 26,
    paddingHorizontal: 10,
    marginRight: 2,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  usePressed: { backgroundColor: colors.hover },
  useText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
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
