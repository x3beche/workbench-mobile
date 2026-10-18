/**
 * The words while they are spoken (live voice to text): what the box held
 * before and the settled words in ink, the tail that may still change
 * dimmed after them. Laid out as the box's own text (same face, size and
 * padding), so nothing moves when the words land in the box at the end. It
 * keeps the newest line in view as it grows, up to the box's six lines.
 */
import { useRef } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts, type } from '../theme/tokens';
import { joinWords } from '../voice/live';
import type { LiveWords as Words } from '../voice/useVoiceRecorder';

/** The ink part and the dimmed part, after `base`. */
export function liveParts(base: string, words: Words): { ink: string; tail: string } {
  const ink = joinWords(base, words.settled.trim());
  const tail = words.tail.trim();
  return { ink, tail: tail ? joinWords(ink, tail).slice(ink.length) : '' };
}

export function LiveWords({
  base = '',
  words,
  lines = 6,
  placeholder = 'Listening',
}: {
  base?: string;
  words: Words;
  lines?: number;
  placeholder?: string;
}) {
  const scroll = useRef<ScrollView>(null);
  const { ink, tail } = liveParts(base, words);
  return (
    <ScrollView
      ref={scroll}
      style={{ maxHeight: type.inputLine * lines + PAD_V * 2 }}
      contentContainerStyle={s.pad}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      testID="live-words"
      accessibilityLiveRegion="polite"
    >
      {ink || tail ? (
        <Text style={s.ink}>
          {ink}
          {tail ? (
            <Text style={s.tail} testID="live-tail">
              {tail}
            </Text>
          ) : null}
        </Text>
      ) : (
        <Text style={s.tail}>{placeholder}</Text>
      )}
    </ScrollView>
  );
}

const PAD_V = 11;

const s = StyleSheet.create({
  pad: { paddingHorizontal: 10, paddingTop: PAD_V, paddingBottom: 4 },
  ink: { fontFamily: fonts.sans, fontSize: type.input, lineHeight: type.inputLine, color: colors.ink },
  tail: { fontFamily: fonts.sans, fontSize: type.input, lineHeight: type.inputLine, color: colors.inkDim },
});
