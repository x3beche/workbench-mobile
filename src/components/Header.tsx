/** A screen's top bar: a title, and room for a control on each side. */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, type } from '../theme/tokens';

export function Header({ title, sub, left, right }: { title: string; sub?: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.bar}>
      {left ? <View style={s.side}>{left}</View> : null}
      <View style={s.mid}>
        <Text style={s.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {sub ? (
          <Text style={s.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ? <View style={[s.side, s.right]}>{right}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  side: { flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  mid: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  sub: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: 1 },
});
