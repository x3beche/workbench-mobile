/**
 * A session group of the drawer (Claude sessions, OpenCode sessions), as the
 * web app's Chat list draws one (rooms/claude-sessions.ts, opencode-sessions.ts):
 * its header is a button - a chevron and the name, and no count (how many there
 * are is the fold's business, not the list's) - that folds and opens it;
 * the choice is the person's, kept on the server (lib/side.ts). Its rows are
 * the conversations' own (DrawerRow): the session's live dot inline, its name
 * (a pin before it when pinned) and when, one line, with what it needs from the
 * person under it when it needs anything - the group's head already says which
 * kind it is, so the row does not say it again. A long press opens Open and
 * Pin / Unpin. Open, it shows the pinned, the newest five and the open one,
 * with "Show N more"; folded, only the pinned.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SideGroup, SidePrefs } from '../api/types';
import type { Dot } from '../lib/orchestrator';
import { isOpen, isPinned, visibleRows } from '../lib/side';
import type { WbcStrings } from '../lib/wbcStrings';
import { colors, fonts, gutter, space } from '../theme/tokens';
import { DrawerRow } from './DrawerRow';
import { ChevronRight, ExternalLink, Pin, PinOff } from './icons';
import { ActionList, Sheet } from './Sheet';
import { Glyph } from './ui';

/** One row as the group draws it. */
export interface SessionRowData {
  id: string;
  name: string;
  /** What the row says under its name, when there is news: waiting for you, starting. */
  note: string | null;
  /** What it says to a screen reader instead of that line: the state, and the computer it runs on. */
  says: string;
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
  const flip = () => {
    if (open) setMore(false);
    onFold(group, !open);
  };
  return (
    <View testID={testID}>
      <GroupHead
        label={label}
        open={open}
        onPress={flip}
        hint={open ? t.foldList : t.unfoldList}
        testID={`${testID}-fold`}
      />
      {shown.map((r) => {
        const pinned = isPinned(prefs, group, r.id);
        return (
          <DrawerRow
            key={r.id}
            title={r.name}
            when={r.when}
            sub={r.note ?? undefined}
            dot={r.dot}
            pinned={pinned}
            on={r.id === selected}
            onPress={() => onOpen(r.id)}
            onLongPress={() => setMenu(r)}
            label={`${r.name}${pinned ? `, ${t.pinned}` : ''}, ${r.says}`}
            testID={`${prefix}-${r.id}`}
          />
        );
      })}
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

/**
 * A group's header, a button: a chevron, the name (and count), and what is
 * worth seeing while folded at its right (a live dot, the rooms' unread).
 */
export function GroupHead({
  label,
  open,
  onPress,
  hint,
  right,
  testID,
}: {
  label: string;
  open: boolean;
  onPress: () => void;
  hint: string;
  right?: ReactNode;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={s.head}
      testID={testID}
    >
      {({ pressed }) => (
        <>
          <View style={[s.caret, open && s.caretOpen]}>
            <Glyph icon={ChevronRight} size={12} color={pressed ? colors.ink : colors.inkDim} />
          </View>
          <Text style={[s.headText, pressed && s.headPressed]}>{label}</Text>
          {right}
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  // The web's .tcv-cc-group: a label over its rows, 10/12/3 around it.
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: 3,
  },
  caret: { width: 11, alignItems: 'center' },
  caretOpen: { transform: [{ rotate: '90deg' }] },
  headText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkDim },
  headPressed: { color: colors.ink },
  more: { minHeight: 32, justifyContent: 'center', paddingHorizontal: gutter },
  moreText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkDim },
});
