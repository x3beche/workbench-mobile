/** A row of options; the chosen one is told by its weight and ink, not by a fill. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, type } from '../theme/tokens';

export function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** Drawn but not usable: the run on that computer cannot take the choice now, and the line under it says why. */
  disabled?: boolean;
}) {
  return (
    <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            disabled={!!disabled}
            onPress={() => onChange(o.id)}
            style={({ pressed }) => [s.opt, pressed && !disabled && s.pressed, !!disabled && s.off]}
          >
            <Text style={[s.text, on && s.on]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, overflow: 'hidden' },
  opt: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.hover },
  off: { opacity: 0.45 },
  text: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
});
