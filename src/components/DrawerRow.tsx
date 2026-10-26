/**
 * One row of the drawer's lists, the same for a conversation and a Claude or
 * OpenCode session (the web's .tcv-cc-item): its title (a pin before it when
 * pinned) with the time at the right; for a session its kind's small icon
 * before the title, the live dot on it, and one line under it - what it does
 * and the computer. Open, the title is white - the same weight as the rest, a
 * step gray - and pressed, it dims.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gutter, space, touch, type } from '../theme/tokens';
import type { Dot } from '../lib/orchestrator';
import { Pin, type LucideIcon } from './icons';
import { StateDot } from './StateDot';
import { Glyph } from './ui';

export function DrawerRow({
  title,
  when,
  sub,
  icon,
  dot,
  pinned = false,
  on,
  onPress,
  onLongPress,
  label,
  hint,
  testID,
}: {
  title: string;
  /** At the right of the title. */
  when?: string;
  /** One line under the title. */
  sub?: string;
  /** The kind's small icon before the title, with `dot` on its corner. */
  icon?: LucideIcon;
  dot?: Dot | null;
  pinned?: boolean;
  on: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  label?: string;
  hint?: string;
  /** `<group>-<id>`: its dot is `<group>-dot-<id>`, its pin `<group>-pin-<id>`. */
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label ?? title}
      accessibilityHint={hint}
      style={[s.row, sub ? s.two : null]}
    >
      {({ pressed }) => (
        <>
          <View style={s.text}>
            <View style={s.top}>
              {pinned ? (
                <View testID={pinId(testID)}>
                  <Glyph icon={Pin} size={12} color={colors.inkDim} />
                </View>
              ) : null}
              {icon ? (
                <View style={s.ico}>
                  <Glyph icon={icon} size={14} color={colors.inkDim} />
                  {dot ? (
                    <View style={s.dot} testID={dotId(testID)}>
                      <StateDot s={dot} size={6} />
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={[s.title, on && s.titleOn, pressed && s.dim]} numberOfLines={1}>
                {title}
              </Text>
              {when ? <Text style={s.when}>{when}</Text> : null}
            </View>
            {sub ? (
              <Text style={s.sub} numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

/** `wbc-<id>` -> `wbc-dot-<id>`, as the session rows have always named theirs. */
const dotId = (id: string) => id.replace(/^([^-]+)-/, '$1-dot-');
const pinId = (id: string) => id.replace(/^([^-]+)-/, '$1-pin-');

/** A title at rest is a step grayer than the panel's ink - as much over the
 *  surface as the web's mix of its ink with the dim one - while the open row's
 *  is white and whole. */
const TITLE_REST = 0.86;

const s = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
  },
  two: { paddingVertical: space.sm },
  ico: { marginRight: 2 },
  // The live dot on the mark's corner, ringed by the drawer's ground.
  dot: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    padding: 1.5,
    borderRadius: 5,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The open one is told by its ink alone - white against titles a step grayer,
  // no heavier face to make the eye hunt for bold (the web's .tcv-cc-item).
  title: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink, opacity: TITLE_REST },
  titleOn: { color: colors.inkBright, opacity: 1 },
  dim: { color: colors.inkDim },
  when: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  sub: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim },
});
