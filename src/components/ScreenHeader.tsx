/**
 * The top bar of a page that is not a conversation: Settings, Analytics,
 * Files, the Claude pool, the Orchestrator. They each drew it themselves -
 * the same 56pt row, the same hairline, the same title style copied five
 * times - and drifted a little apart in the copying. It is one bar now: the
 * menu button (or the space it leaves), what belongs in the middle, and what
 * belongs at the right.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space, type } from '../theme/tokens';
import { Menu } from './icons';
import { IconButton } from './ui';

export function ScreenHeader({
  title,
  center,
  left,
  right,
  onMenu,
  menuTestID,
  menuLabel = 'Open the conversations',
  sub,
}: {
  /** The page's name, unless `center` says something else. */
  title?: string;
  /** What goes where the title goes (a search field, a name being changed). */
  center?: ReactNode;
  /** What leads the bar; the menu button when `onMenu` is given. */
  left?: ReactNode;
  right?: ReactNode;
  onMenu?: () => void;
  menuTestID?: string;
  menuLabel?: string;
  /** A second line under the title (the Orchestrator's state). */
  sub?: ReactNode;
}) {
  const leading =
    left ??
    (onMenu ? (
      <IconButton icon={Menu} label={menuLabel} onPress={onMenu} testID={menuTestID} />
    ) : (
      <View style={s.pad} />
    ));
  return (
    <View style={s.head}>
      {leading}
      {center ??
        (title !== undefined ? (
          <View style={s.mid}>
            <Text style={s.title} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
            {sub ? <View style={s.sub}>{sub}</View> : null}
          </View>
        ) : null)}
      {right ?? null}
    </View>
  );
}

const s = StyleSheet.create({
  head: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pad: { width: space.sm },
  mid: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  sub: { marginTop: 1 },
});
