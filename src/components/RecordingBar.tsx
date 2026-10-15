/** While recording: a small red dot, the time, and the two ways to end it (an X, and a round tick or stop). */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, type } from '../theme/tokens';
import { formatDuration, MAX_RECORD_MS } from '../voice/voice';
import { Check, Square, X } from './icons';
import { Glyph, IconButton } from './ui';

export function RecordingBar({
  phase,
  elapsed,
  onCancel,
  onDone,
  doneLabel = 'Done',
}: {
  phase: 'recording' | 'transcribing';
  elapsed: number;
  onCancel: () => void;
  onDone: () => void;
  /** "Done" turns the recording into text; "Stop" ends it for review. */
  doneLabel?: 'Done' | 'Stop';
}) {
  if (phase === 'transcribing') {
    return (
      <View style={s.bar} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.inkDim} />
        <Text style={s.label}>Transcribing</Text>
      </View>
    );
  }
  const left = MAX_RECORD_MS - elapsed;
  return (
    <View style={s.bar} testID="recording-bar">
      <View style={s.dot} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={s.time} accessibilityLabel={`Recording, ${Math.floor(elapsed / 1000)} seconds`}>
        {formatDuration(elapsed)}
      </Text>
      <Text style={s.label} numberOfLines={1}>
        {left < 30_000 ? `Stops in ${Math.ceil(left / 1000)} s` : 'Recording'}
      </Text>
      <IconButton
        icon={X}
        label="Cancel the recording"
        onPress={onCancel}
        testID="voice-cancel"
        size={20}
        color={colors.inkDim}
        style={s.cancel}
      />
      <Pressable
        testID="voice-done"
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={doneLabel === 'Stop' ? 'Stop recording' : 'Done: turn it into text'}
        hitSlop={6}
        style={({ pressed }) => [s.round, pressed && s.pressed]}
      >
        <Glyph
          icon={doneLabel === 'Stop' ? Square : Check}
          size={doneLabel === 'Stop' ? 14 : 20}
          color={colors.inkOnAccent}
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pen, marginLeft: 6 },
  time: { fontFamily: fonts.mono, fontSize: type.body, color: colors.ink, minWidth: 44 },
  label: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  cancel: { width: 40, height: 40 },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  pressed: { opacity: 0.75 },
});
