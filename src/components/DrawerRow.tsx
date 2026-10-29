/**
 * One row of the drawer's lists, the same for a conversation and a Claude or
 * OpenCode session - the web's .tcv-cc-item (frontend/src/styles.css): a pin
 * before the title when it is pinned, a session's live dot inline before it,
 * the time at the right in the mono face, and one line under it when there is
 * news. A session's kind is the group's head's business, so the row does not
 * say it again (the web's .wbx-dot). Open, the title is white - the same
 * weight as the rest, a step gray - and pressed, it dims. Selecting several,
 * a checkbox leads the row.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gutter, touch, type } from '../theme/tokens';
import type { Dot } from '../lib/orchestrator';
import { Check, Ellipsis, Pin } from './icons';
import { StateDot } from './StateDot';
import { Glyph } from './ui';

/** How much of the panel's ink a title at rest is: a step grayer than the open
 *  one's white, as the web mixes its ink with the dim one. */
const TITLE_REST = 0.86;

export function DrawerRow({
  title,
  when,
  sub,
  dot,
  pinned = false,
  check,
  on,
  onPress,
  onLongPress,
  onMore,
  moreLabel,
  label,
  hint,
  testID,
}: {
  title: string;
  /** At the right of the title. */
  when?: string;
  /** One line under the title. */
  sub?: string;
  /** A session's live state, a dot before the title; null or absent for a conversation. */
  dot?: Dot | null;
  pinned?: boolean;
  /** Selecting several: the row's box is ticked (false), or it leads the row (undefined = not selecting). */
  check?: boolean;
  on: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  /**
   * The row's actions as a button of their own, at its end: a swipe and a long
   * press are both invisible, and a phone held in one hand has room for one
   * more mark. Its own label says what it does.
   */
  onMore?: () => void;
  /** What its … is for, in the caller's words: "Actions for Trip photos". */
  moreLabel?: string;
  label?: string;
  hint?: string;
  /** `<group>-<id>`: its dot is `<group>-dot-<id>`, its pin `<group>-pin-<id>`, its box `<group>-<id>-check`. */
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole={check === undefined ? 'button' : 'checkbox'}
      accessibilityState={check === undefined ? { selected: on } : { checked: check, selected: on }}
      accessibilityLabel={label ?? title}
      accessibilityHint={hint}
      accessibilityActions={onMore ? [{ name: 'more', label: 'Actions' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'more') onMore?.();
      }}
      style={[s.row, sub ? s.two : null]}
    >
      {({ pressed }) => (
        <>
          {check === undefined ? null : (
            <View style={[s.box, check && s.boxOn]} testID={checkId(testID)}>
              {check ? <Glyph icon={Check} size={12} color={colors.inkOnAccent} /> : null}
            </View>
          )}
          <View style={s.text}>
            <View style={s.top}>
              {pinned ? (
                <View testID={pinId(testID)}>
                  <Glyph icon={Pin} size={12} color={colors.inkDim} />
                </View>
              ) : null}
              {dot ? (
                <View style={s.dot} testID={dotId(testID)}>
                  <StateDot s={dot} size={7} />
                </View>
              ) : null}
              <Text style={[s.title, on && s.titleOn, pressed && s.dim]} numberOfLines={1}>
                {title}
              </Text>
              {when ? (
                <Text style={s.when} numberOfLines={1}>
                  {when}
                </Text>
              ) : null}
            </View>
            {sub ? (
              <Text style={s.sub} numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
          </View>
          {onMore ? (
            <Pressable
              testID={`${testID}-more`}
              onPress={onMore}
              accessibilityRole="button"
              accessibilityLabel={moreLabel ?? `Actions for ${title}`}
              hitSlop={{ left: 4, right: 4 }}
              style={({ pressed }) => [s.moreBtn, pressed && s.morePressed]}
            >
              <Glyph icon={Ellipsis} size={16} color={colors.inkDim} />
            </Pressable>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** `wbc-<id>` -> `wbc-dot-<id>`, as the session rows have always named theirs. */
const dotId = (id: string) => id.replace(/^([^-]+)-/, '$1-dot-');
const pinId = (id: string) => id.replace(/^([^-]+)-/, '$1-pin-');

const checkId = (id: string) => `${id}-check`;

const s = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: gutter,
  },
  // Two lines: the title and what was last said - the web's 6, and its line heights.
  two: { paddingVertical: 6 },
  box: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dot: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The open one is told by its ink alone - white against titles a step grayer,
  // no heavier face to make the eye hunt for bold (the web's .tcv-cc-item).
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.sansMedium,
    fontSize: type.row,
    color: colors.ink,
    opacity: TITLE_REST,
  },
  titleOn: { color: colors.inkBright, opacity: 1 },
  dim: { color: colors.inkDim },
  // One width, so the times of every row stand in one column ("Sun" and "14:05" alike).
  when: { flexShrink: 0, minWidth: 44, textAlign: 'right', fontFamily: fonts.mono, fontSize: type.micro, color: colors.inkDim },
  sub: { fontFamily: fonts.sans, fontSize: type.micro, lineHeight: type.microLine, color: colors.inkDim },
  // The row's actions: 36 wide and the row's own 44 high, with the slop that
  // makes the whole target 44 - it sits where nothing else is tapped.
  moreBtn: { width: 36, height: touch, alignItems: 'center', justifyContent: 'center' },
  morePressed: { opacity: 0.6 },
});
