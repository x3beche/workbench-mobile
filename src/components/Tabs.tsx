/**
 * A row of text tabs filling the width, one line. The chosen one is told by
 * weight and ink only - no fill, no underline (the web app's rule).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gutter, type } from '../theme/tokens';

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  testID,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  testID?: string;
}) {
  return (
    <View style={s.row} accessibilityRole="tablist" testID={testID}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Pressable
            key={t.id}
            testID={testID ? `${testID}-${t.id}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            onPress={() => onChange(t.id)}
            style={s.tab}
          >
            {({ pressed }) => (
              <Text style={[s.label, on && s.on, pressed && !on && s.pressed]} numberOfLines={1}>
                {t.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: gutter - 8 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  label: { fontFamily: fonts.sans, fontSize: type.small + 1, color: colors.inkDim },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  pressed: { color: colors.ink },
});
