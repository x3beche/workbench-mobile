/**
 * "New messages" with an arrow down, floating over the bottom of a thread
 * when something new came while one reads further up; a press goes down to
 * it. Nothing pulls the reader down by itself.
 */
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, motion, radius, type } from '../theme/tokens';
import { Appear } from './Appear';
import { ArrowDown } from './icons';
import { Glyph } from './ui';

export function NewBelow({ label, onPress, bottom = 12 }: { label: string; onPress: () => void; bottom?: number }) {
  return (
    <Appear fill={false} from="below" duration={motion.fade} style={[s.wrap, { bottom }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [s.btn, pressed && s.pressed]}
        testID="new-below"
        hitSlop={6}
      >
        <Text style={s.text}>{label}</Text>
        <Glyph icon={ArrowDown} size={15} color={colors.ink} />
      </Pressable>
    </Appear>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center' },
  btn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.pressed,
    backgroundColor: colors.surface2,
  },
  pressed: { backgroundColor: colors.hover },
  text: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.ink },
});
