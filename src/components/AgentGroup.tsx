/**
 * The drawer's Agents group: one's own Claude Code sessions and OpenCode sessions as one list, and the ones a
 * person put under another drawn under it, indented - the web's Chat list (frontend/src/app/rooms/agents-list.ts).
 * A long press (or the row's …) opens Open, Put under …, On its own and Pin / Unpin; there is no dragging on a
 * phone. The rules are the server's (backend/agents.py) and are checked here first (lib/agents.ts) so a move
 * that cannot be taken is not offered. Folded or open as the person chose (the "agents" fold, lib/side.ts);
 * open, it shows the pinned trees, the newest five and the open one's, with "Show N more".
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SideGroup, SidePrefs } from '../api/types';
import { type LinkMap, treeOf, whyNot } from '../lib/agents';
import type { AgentStrings } from '../lib/agentStrings';
import { FOLD_FIRST, isOpen, isPinned } from '../lib/side';
import type { WbcStrings } from '../lib/wbcStrings';
import { colors, fonts, gutter, type } from '../theme/tokens';
import { DrawerRow } from './DrawerRow';
import { ExternalLink, FolderInput, LogOut, Pin, PinOff, SquareCode, SquareTerminal } from './icons';
import { GroupHead, type SessionRowData } from './SessionGroup';
import { ActionList, Sheet } from './Sheet';

/** One row: a session of either kind, named by its key ("wbc:<id>" / "wbo:<id>"). */
export interface AgentRowData extends SessionRowData {
  key: string;
  group: SideGroup;
  /** Its last sign, epoch ms (the tree's order). */
  last: number;
  /** One OpenCode started itself for a sub-agent: never offered as a manager. */
  child: boolean;
  /** Not used in the last day and doing nothing: shown on "Show N older". */
  old?: boolean;
}

const STEP = 24;
const ICON_CENTER_Y = 16;
const railX = (col: number) => gutter + (col - 1) * STEP + 8;
const elbowX = (depth: number) => gutter + (depth - 1) * STEP + 8;
const trunkX = (depth: number) => gutter + depth * STEP + 8;

export function AgentGroup({
  rows: every,
  links,
  maxDepth,
  prefs,
  selected,
  searching,
  t,
  a,
  onOpen,
  onFold,
  onPin,
  onLink,
  testID = 'drawer-agents',
}: {
  rows: AgentRowData[];
  links: LinkMap;
  maxDepth: number;
  prefs: SidePrefs;
  /** The open session's key. */
  selected: string | null;
  searching: boolean;
  /** The session groups' shared words (open, pin, show more). */
  t: WbcStrings;
  a: AgentStrings;
  onOpen: (row: AgentRowData) => void;
  onFold: (group: 'agents', open: boolean) => void;
  onPin: (group: SideGroup, id: string, pinned: boolean) => void;
  /** Put a worker under a manager (null: on its own again). */
  onLink: (worker: string, manager: string | null) => void;
  testID?: string;
}) {
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState<AgentRowData | null>(null);
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set());
  const [showOld, setShowOld] = useState(false);
  const rows = showOld ? every : every.filter((r) => !r.old);
  const older = showOld ? 0 : every.length - rows.length;
  const pinned = (r: AgentRowData) => isPinned(prefs, r.group, r.id);
  const pinAt = (r: AgentRowData) => {
    const i = prefs.pins[r.group].indexOf(r.id);
    return i < 0 ? Infinity : i;
  };
  const tree = useMemo(
    () => treeOf(rows, (r) => r.key, (r) => r.last, links, (x, y) => pinAt(x) - pinAt(y) || y.last - x.last, maxDepth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, links, prefs, maxDepth],
  );
  if (!every.length) return null;
  // Live is doing something: a connected computer holds every session of it, so connected alone is not news.
  const busy = (r: AgentRowData) => !!r.dot && r.dot !== 'idle';
  const auto = searching || rows.some((r) => busy(r) || r.key === selected);
  const open = searching || isOpen(prefs, 'agents', auto);
  const tops = tree.filter((x) => x.depth === 0).map((x) => x.top);
  const selTop = tree.find((x) => x.row.key === selected)?.top;
  let n = 0;
  const keepTops = new Set(
    // Folded is folded: the head's summary says what is there.
    !open ? [] : searching || more ? tops : tops.filter((r) => pinned(r) || r === selTop || n++ < FOLD_FIRST),
  );
  const hiddenByFold = (key: string) => {
    if (searching) return false;
    let cur = links.get(key);
    for (let i = 0; cur && i <= maxDepth; i++) {
      if (shut.has(cur)) return true;
      cur = links.get(cur);
    }
    return false;
  };
  const shown = tree.filter((x) => keepTops.has(x.top) && !hiddenByFold(x.row.key));
  const hidden = tops.length - tops.filter((r) => keepTops.has(r)).length;
  const flip = () => {
    if (open) setMore(false);
    onFold('agents', !open);
  };
  const twist = (key: string) =>
    setShut((now) => {
      const next = new Set(now);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const team = (key: string) => {
    const under = rows.filter((r) => links.get(r.key) === key);
    return a.team(under.length, under.filter((r) => r.dot === 'running').length);
  };
  // Managers worth offering: one's pinned, the busy and the last day's - never a sub-agent OpenCode started itself.
  const candidates = (r: AgentRowData) =>
    rows
      .filter((x) => x.key !== r.key && x.key !== links.get(r.key) && !x.child
                     && (pinned(x) || busy(x) || Date.now() - x.last < 86_400_000)
                     && !whyNot(links, r.key, x.key, maxDepth))
      .slice(0, 6);
  return (
    <View testID={testID}>
      <GroupHead
        label={a.group}
        open={open}
        onPress={flip}
        hint={open ? t.foldList : t.unfoldList}
        right={<Text style={s.sum} testID={`${testID}-sum`}>{a.summary(rows.length, rows.filter((r) => r.dot === 'running').length, rows.filter((r) => r.dot === 'retry').length)}</Text>}
        testID={`${testID}-fold`}
      />
      {shown.map(({ row: r, depth, kids, last, rails }) => {
        const pin = pinned(r);
        const icon = r.group === 'claude' ? SquareTerminal : SquareCode;
        const managerX = depth > 0 ? elbowX(depth) : 0;
        const trunkLine = kids > 0 && !shut.has(r.key);
        return (
          <View key={r.key} style={s.rowWrap}>
            <View style={[s.grow, { paddingLeft: depth * STEP }]}>
              <DrawerRow
                title={r.name}
                when={r.when}
                sub={kids ? undefined : (r.note ?? undefined)}
                subNode={
                  kids ? (
                    <Pressable
                      testID={`agent-twist-${r.key}`}
                      onPress={() => twist(r.key)}
                      accessibilityRole="button"
                      accessibilityLabel={shut.has(r.key) ? a.showTeam : a.hideTeam}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={s.teamBtn}
                    >
                      <Text style={s.teamText} numberOfLines={1}>
                        {team(r.key)}
                      </Text>
                      <Text style={[s.teamCaret, !shut.has(r.key) && s.teamCaretOpen]} aria-hidden>
                        ›
                      </Text>
                    </Pressable>
                  ) : undefined
                }
                icon={icon}
                live={r.live}
                dot={busy(r) ? r.dot : null}
                pinned={pin}
                on={r.key === selected}
                onPress={() => onOpen(r)}
                onLongPress={() => setMenu(r)}
                onMore={() => setMenu(r)}
                label={`${r.name}${pin ? `, ${t.pinned}` : ''}, ${r.says}`}
                testID={`agent-${r.key}`}
              />
            </View>
            {/* Rails from ancestors running down past this row */}
            {rails.map((col) => (
              <View key={col} style={[s.vertLine, { left: railX(col) }]} pointerEvents="none" />
            ))}
            {/* Trunk down from manager icon to its children */}
            {trunkLine ? (
              <View style={[s.trunk, { left: trunkX(depth) }]} pointerEvents="none" />
            ) : null}
            {/* Elbow from manager to this row: └ for last child, ├ for others */}
            {depth > 0 ? (
              last ? (
                <View style={[s.elbow, { left: managerX, width: 16 }]} pointerEvents="none" />
              ) : (
                <>
                  <View style={[s.vertLine, { left: managerX }]} pointerEvents="none" />
                  <View style={[s.horizLine, { left: managerX, width: 16 }]} pointerEvents="none" />
                </>
              )
            ) : null}
          </View>
        );
      })}
      {open && hidden > 0 ? (
        <Pressable onPress={() => setMore(true)} accessibilityRole="button" style={s.more} testID={`${testID}-more`}>
          {({ pressed }) => <Text style={[s.moreText, pressed && s.pressed]}>{t.showMore(hidden)}</Text>}
        </Pressable>
      ) : open && older > 0 ? (
        <Pressable onPress={() => { setShowOld(true); setMore(true); }} accessibilityRole="button" style={s.more}
                   testID={`${testID}-older`}>
          {({ pressed }) => <Text style={[s.moreText, pressed && s.pressed]}>{a.showOlder(older)}</Text>}
        </Pressable>
      ) : open && showOld && !searching ? (
        <Pressable onPress={() => { setShowOld(false); setMore(false); }} accessibilityRole="button" style={s.more}
                   testID={`${testID}-hide-older`}>
          {({ pressed }) => <Text style={[s.moreText, pressed && s.pressed]}>{a.hideOlder}</Text>}
        </Pressable>
      ) : null}
      {menu ? (
        <Sheet onClose={() => setMenu(null)} title={menu.name} testID={`${testID}-menu`}>
          <ActionList
            actions={[
              { id: 'agent-open', label: t.open, icon: ExternalLink, onPress: () => { setMenu(null); onOpen(menu); } },
              ...candidates(menu).map((c) => ({
                id: `agent-under-${c.key}`,
                label: a.putUnder(c.name),
                icon: FolderInput,
                onPress: () => { setMenu(null); onLink(menu.key, c.key); },
              })),
              ...(links.has(menu.key)
                ? [{ id: 'agent-own', label: a.onItsOwn, icon: LogOut, onPress: () => { setMenu(null); onLink(menu.key, null); } }]
                : []),
              pinned(menu)
                ? { id: 'agent-unpin', label: t.unpin, icon: PinOff, onPress: () => { setMenu(null); onPin(menu.group, menu.id, false); } }
                : { id: 'agent-pin', label: t.pin, icon: Pin, onPress: () => { setMenu(null); onPin(menu.group, menu.id, true); } },
            ]}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  rowWrap: { position: 'relative' },
  grow: { flex: 1 },
  vertLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.line, zIndex: 1 },
  horizLine: { position: 'absolute', top: ICON_CENTER_Y, height: 1, backgroundColor: colors.line, zIndex: 1 },
  elbow: {
    position: 'absolute',
    top: 0,
    height: ICON_CENTER_Y + 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: 4,
    zIndex: 1,
  },
  trunk: { position: 'absolute', top: ICON_CENTER_Y + 8, bottom: 0, width: 1, backgroundColor: colors.line, zIndex: 1 },
  teamBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  teamText: { fontFamily: fonts.sans, fontSize: type.micro, lineHeight: type.microLine, color: colors.inkDim },
  teamCaret: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.inkDim, marginTop: -1 },
  teamCaretOpen: { transform: [{ rotate: '90deg' }] },
  more: { minHeight: 32, justifyContent: 'center', paddingHorizontal: gutter },
  moreText: { fontFamily: fonts.sansMedium, fontSize: type.micro, color: colors.inkDim },
  pressed: { color: colors.ink },
  sum: { marginLeft: 'auto', fontFamily: fonts.sans, fontSize: type.micro, color: colors.inkDim },
});
