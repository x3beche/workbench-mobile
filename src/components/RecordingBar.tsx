/** While recording: a small red dot, the time, and the two ways to end it. */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, type } from '../theme/tokens';
import { formatDuration, MAX_RECORD_MS } from '../voice/voice';
import { Button } from './ui';

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
  doneLabel?: string;
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
      <Button label="Cancel" variant="quiet" onPress={onCancel} testID="voice-cancel" />
      <Button label={doneLabel} variant="primary" onPress={onDone} testID="voice-done" />
    </View>
  );
}

const s = StyleSheet.create({
  bar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pen },
  time: { fontFamily: fonts.mono, fontSize: type.body, color: colors.ink, minWidth: 44 },
  label: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
});
