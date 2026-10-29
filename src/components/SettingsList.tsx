/**
 * The pieces every Settings page is made of. One list, one measure: a row is
 * an icon, its name, one line of quiet words under it and the value it is set
 * to now, with a chevron where a tap leads somewhere else. A group is a small
 * capitalised heading over rows divided by the same hairline, and the page
 * they sit on is a column the same width on a phone and on a wide screen.
 *
 * The heights, gutters, type and hairlines are written once, here, so no page
 * can drift from another: Settings is read by scanning, and a row that is 56
 * on one page and 64 on the next is what stops that.
 *
 * Colours are the theme's tokens and nothing else (theme/tokens.ts); no row
 * carries an accent of its own - the one red is a dangerous action, at the
 * bottom of its list.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, gutter, indicatorStyle, space, type } from '../theme/tokens';
import { Check, ChevronLeft, ChevronRight, type LucideIcon } from './icons';
import { ScreenHeader } from './ScreenHeader';
import { Glyph, IconButton } from './ui';

/** The column a page is drawn in: the same on a phone and centred on a wide screen. */
const COLUMN = 640;
/** The icon's own column, and the gap after it: the hairline starts where the words do. */
const ICON_COL = 28;
const GAP = 12;
/** Every row at least this tall, with or without its second line. */
const ROW_MIN = 60;

/** A heading over a run of rows: "ACCOUNT", "APPEARANCE". */
export function SettingsGroup({
  title,
  children,
  note,
  testID,
}: {
  /** The heading; a page whose title already says it leaves it out. */
  title?: string;
  children: ReactNode;
  /** A line of explanation under the group's rows, when the rows cannot say it. */
  note?: ReactNode;
  testID?: string;
}) {
  return (
    <View style={[s.group, !title && s.groupBare]} testID={testID}>
      {title ? (
        <Text style={s.groupTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
      {note ? <View style={s.groupNote}>{note}</View> : null}
    </View>
  );
}

/**
 * A row that goes somewhere: its icon, its name, one line about it, the value
 * it is set to now and a chevron. `danger` draws it in the theme's red - only
 * for what ends a session or takes an account off the phone.
 */
export function SettingsRow({
  icon,
  title,
  sub,
  value,
  onPress,
  danger,
  last,
  testID,
  valueTestID,
  accessibilityLabel,
}: {
  icon?: LucideIcon;
  title: string;
  /** One line, quiet: what the row is for. */
  sub?: string;
  /** What it is set to now, at the right before the chevron. */
  value?: string;
  onPress: () => void;
  danger?: boolean;
  /** The last row of its group: no hairline under it. */
  last?: boolean;
  testID?: string;
  valueTestID?: string;
  accessibilityLabel?: string;
}) {
  const tint = danger ? colors.danger : colors.ink;
  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? [title, value].filter(Boolean).join(', ')}
        accessibilityHint={sub}
        style={({ pressed }) => [s.row, pressed && s.pressed]}
        testID={testID}
      >
        {icon ? (
          <View style={s.iconCol}>
            <Glyph icon={icon} size={20} color={tint} />
          </View>
        ) : (
          <View style={s.iconCol} />
        )}
        <View style={s.mid}>
          <Text style={[s.title, danger && s.dangerText]} numberOfLines={1}>
            {title}
          </Text>
          {sub ? (
            <Text style={s.sub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        {value ? (
          <Text style={s.value} numberOfLines={1} testID={valueTestID}>
            {value}
          </Text>
        ) : null}
        <Glyph icon={ChevronRight} size={17} color={colors.inkDim} />
      </Pressable>
      {last ? null : <View style={s.sep} />}
    </>
  );
}

/**
 * One choice on a page of choices: the name, what choosing it means, and a
 * check when it is the one set now. `leading` takes the place of the check's
 * column for something to look at (a theme's colours).
 */
export function SettingsChoice({
  title,
  sub,
  on,
  onPress,
  leading,
  trailing,
  last,
  testID,
  accessibilityLabel,
}: {
  title: string;
  sub?: string;
  on: boolean;
  onPress: () => void;
  leading?: ReactNode;
  /** A control of its own at the row's end (taking an account off the phone). */
  trailing?: ReactNode;
  last?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={sub}
        style={({ pressed }) => [s.row, pressed && s.pressed]}
        testID={testID}
      >
        {leading ?? <View style={s.iconCol} />}
        <View style={s.mid}>
          <Text style={[s.title, on && s.on]} numberOfLines={1}>
            {title}
          </Text>
          {sub ? (
            <Text style={s.sub} numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
        </View>
        {on ? <Glyph icon={Check} size={19} color={colors.inkBright} /> : <View style={s.checkPad} />}
        {trailing ? <View style={s.trailing}>{trailing}</View> : null}
      </Pressable>
      {last ? null : <View style={s.sep} />}
    </>
  );
}

/** A paragraph under a group: how to do the thing the rows above are about. */
export function SettingsNote({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text style={s.note} testID={testID}>
      {children}
    </Text>
  );
}

/** What a page is for: a paragraph under its name, before its rows. */
export function SettingsAbout({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text style={s.about} testID={testID}>
      {children}
    </Text>
  );
}

/** A page under Settings: its name, the way back, and the column its rows sit in. */
export function SettingsPage({
  title,
  onBack,
  backLabel,
  children,
  testID,
}: {
  title: string;
  onBack: () => void;
  backLabel: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID={testID}>
      <ScreenHeader
        title={title}
        left={<IconButton icon={ChevronLeft} label={backLabel} onPress={onBack} testID="settings-back" />}
      />
      <ScrollView indicatorStyle={indicatorStyle} contentContainerStyle={s.body} testID="settings-page">
        <View style={s.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The menu's own scroll: the same column, with the room a thumb needs at the foot. */
export function SettingsScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView indicatorStyle={indicatorStyle} contentContainerStyle={s.body}>
      <View style={s.column}>{children}</View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  body: { paddingBottom: space.xxl },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  group: { paddingTop: space.lg },
  groupBare: { paddingTop: space.md },
  groupTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: type.micro,
    lineHeight: type.microLine,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkDim,
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: 6,
  },
  groupNote: { paddingHorizontal: gutter, paddingTop: space.sm },
  row: {
    minHeight: ROW_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingVertical: 10,
  },
  pressed: { backgroundColor: colors.hover },
  iconCol: { width: ICON_COL, alignItems: 'flex-start', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0, marginLeft: GAP },
  title: { fontFamily: fonts.sans, fontSize: type.lead, lineHeight: type.leadLine, color: colors.ink },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  dangerText: { color: colors.danger },
  sub: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.inkDim },
  value: {
    flexShrink: 1,
    maxWidth: '45%',
    marginLeft: space.sm,
    fontFamily: fonts.sans,
    fontSize: type.small,
    color: colors.inkDim,
    textAlign: 'right',
  },
  checkPad: { width: 19 },
  trailing: { marginLeft: space.sm },
  sep: { height: 1, marginLeft: gutter + ICON_COL + GAP, backgroundColor: colors.line },
  note: {
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
  },
  about: {
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
    paddingHorizontal: gutter,
    paddingTop: space.lg,
  },
});
