/**
 * A session group of the drawer (Claude sessions, OpenCode sessions), as the
 * web app's Chat list draws one (rooms/claude-sessions.ts, opencode-sessions.ts):
 * its header is a button - a chevron, the name and the count, and while
 * folded a live dot when a session in it is live - that folds and opens it;
 * the choice is the person's, kept on the server (lib/side.ts). Its rows: a
 * mark with the session's live dot, its name (a pin before it when pinned)
 * and when, and what it does with the computer. A long press opens Open and
 * Pin / Unpin. Open, it shows the pinned, the newest five and the open one,
 * with "Show N more"; folded, only the pinned.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SideGroup, SidePrefs } from '../api/types';
import type { Dot } from '../lib/orchestrator';
import { isOpen, isPinned, visibleRows } from '../lib/side';
import { groupDot } from '../lib/wbo';
import type { WbcStrings } from '../lib/wbcStrings';
import { colors, fonts, gutter, space, touch, type } from '../theme/tokens';
import { ChevronRight, ExternalLink, Pin, PinOff, type LucideIcon } from './icons';
import { ActionList, Sheet } from './Sheet';
import { StateDot } from './StateDot';
import { Glyph } from './ui';

/** One row as the group draws it. */
export interface SessionRowData {
  id: string;
  name: string;
  /** What it does now, with the computer. */
  snip: string;
  /** When it was last used, as the drawer writes times. */
  when: string;
  dot: Dot | null;
  /** Live (a session in the group being live opens it by default). */
  live: boolean;
}

export function SessionGroup({
  group,
  label,
  rows,
  icon,
  prefs,
  selected,
  searching,
  t,
  onOpen,
  onFold,
  onPin,
  testID,
  prefix,
}: {
  group: SideGroup;
  label: string;
  rows: SessionRowData[];
  icon: LucideIcon;
  prefs: SidePrefs;
  selected: string | null;
  searching: boolean;
  t: WbcStrings;
  onOpen: (id: string) => void;
  onFold: (group: SideGroup, open: boolean) => void;
  onPin: (group: SideGroup, id: string, pinned: boolean) => void;
  testID: string;
  /** Its rows' testIDs: `<prefix>-<id>`, their dots `<prefix>-dot-<id>`. */
  prefix: string;
}) {
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState<SessionRowData | null>(null);
  if (!rows.length) return null;
  // Open by itself until the person chooses: a session in it is live or open, or a search is on.
  const auto = searching || rows.some((r) => r.live || r.id === selected);
  const open = searching || isOpen(prefs, group, auto);
  const shown = visibleRows(prefs, group, rows, (r) => r.id, open, selected, searching || more);
  const hidden = rows.length - shown.length;
  const liveDot = open ? null : groupDot(rows.map((r) => r.dot));
  const flip = () => {
    if (open) setMore(false);
    onFold(group, !open);
  };
  return (
    <View testID={testID}>
      <Pressable
        onPress={flip}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${rows.length}`}
        accessibilityHint={open ? t.foldList : t.unfoldList}
        style={s.head}
        testID={`${testID}-fold`}
      >
        {({ pressed }) => (
          <>
            <View style={[s.caret, open && s.caretOpen]}>
              <Glyph icon={ChevronRight} size={14} color={pressed ? colors.ink : colors.inkDim} />
            </View>
            <Text style={[s.headText, pressed && s.headPressed]}>
              {label} · {rows.length}
            </Text>
            {liveDot ? (
              <View testID={`${testID}-dot`}>
                <StateDot s={liveDot} size={7} />
              </View>
            ) : null}
          </>
        )}
      </Pressable>
      {shown.map((r) => (
        <Row
          key={r.id}
          r={r}
          prefix={prefix}
          icon={icon}
          on={r.id === selected}
          pinned={isPinned(prefs, group, r.id)}
          pinnedLabel={t.pinned}
          onPress={() => onOpen(r.id)}
          onLong={() => setMenu(r)}
        />
      ))}
      {open && hidden > 0 ? (
        <Pressable onPress={() => setMore(true)} accessibilityRole="button" style={s.more} testID={`${testID}-more`}>
          {({ pressed }) => <Text style={[s.moreText, pressed && s.headPressed]}>{t.showMore(hidden)}</Text>}
        </Pressable>
      ) : null}
      {menu ? (
        <Sheet onClose={() => setMenu(null)} title={menu.name} testID={`${testID}-menu`}>
          <ActionList
            actions={[
              {
                id: 'session-open',
                label: t.open,
                icon: ExternalLink,
                onPress: () => {
                  setMenu(null);
                  onOpen(menu.id);
                },
              },
              isPinned(prefs, group, menu.id)
                ? {
                    id: 'session-unpin',
                    label: t.unpin,
                    icon: PinOff,
                    onPress: () => {
                      setMenu(null);
                      onPin(group, menu.id, false);
                    },
                  }
                : {
                    id: 'session-pin',
                    label: t.pin,
                    icon: Pin,
                    onPress: () => {
                      setMenu(null);
                      onPin(group, menu.id, true);
                    },
                  },
            ]}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

function Row({
  r,
  prefix,
  icon,
  on,
  pinned,
  pinnedLabel,
  onPress,
  onLong,
}: {
  r: SessionRowData;
  prefix: string;
  icon: LucideIcon;
  on: boolean;
  pinned: boolean;
  pinnedLabel: string;
  onPress: () => void;
  onLong: () => void;
}) {
  return (
    <Pressable
      testID={`${prefix}-${r.id}`}
      onPress={onPress}
      onLongPress={onLong}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${r.name}${pinned ? `, ${pinnedLabel}` : ''}, ${r.snip}`}
      style={s.row}
    >
      {({ pressed }) => (
        <>
          <View style={s.ico}>
            <Glyph icon={icon} size={20} color={pressed ? colors.inkDim : colors.ink} />
            {r.dot ? (
              <View style={s.dot} testID={`${prefix}-dot-${r.id}`}>
                <StateDot s={r.dot} size={8} />
              </View>
            ) : null}
          </View>
          <View style={s.text}>
            <View style={s.top}>
              {pinned ? (
                <View testID={`${prefix}-pin-${r.id}`}>
                  <Glyph icon={Pin} size={12} color={colors.inkDim} />
                </View>
              ) : null}
              <Text style={[s.title, on && s.titleOn, pressed && s.dim]} numberOfLines={1}>
                {r.name}
              </Text>
              {r.when ? <Text style={s.when}>{r.when}</Text> : null}
            </View>
            <Text style={s.snip} numberOfLines={1}>
              {r.snip}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  caret: { width: 14, alignItems: 'center' },
  caretOpen: { transform: [{ rotate: '90deg' }] },
  headText: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.inkDim },
  headPressed: { color: colors.ink },
  more: { minHeight: 36, justifyContent: 'center', paddingHorizontal: gutter, paddingLeft: gutter + 32 },
  moreText: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.inkDim },
  row: {
    backgroundColor: colors.surface,
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: gutter,
    paddingVertical: space.sm + 2,
  },
  ico: { width: 20, paddingTop: 2, alignItems: 'center' },
  // The live dot on the mark's corner, ringed by the drawer's ground.
  dot: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    padding: 2,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, minWidth: 0, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  titleOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  dim: { color: colors.inkDim },
  when: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  snip: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim },
});
