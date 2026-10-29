/**
 * What the drawer holds: search and New chat at the top, then the workspace's
 * rooms (3D Drawing, PCB Design, Firmware) with their last line, then the web's
 * own tab row over the conversations - Conversations, Archived, Trash, small
 * and left-aligned, with Select at its right (styles.css, .tcv-cc-tabrow) -
 * the conversations by day, one line each, the open one in brighter ink. A
 * swipe to the left on a row shows its buttons (Archive and Delete; Unarchive;
 * Restore and Delete forever in the trash); Select ticks several and does it to
 * all of them at once. At the bottom: Files, and the account, which opens
 * Account - with a dot and "Update ready: 1.5.1" when an update is ready there.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CHAT_TRASH_DAYS, type VoiceLang, type WorkbenchClient } from '../api/client';
import { displayServer } from '../api/server';
import type {
  Chat,
  ChatScope,
  FoldGroup,
  Room,
  RoomId,
  SideGroup,
  SidePrefs,
  User,
  WbcSession,
  WboSession,
} from '../api/types';
import { chatSnippet, filterChats, groupChats, groupOf, rowTime } from '../lib/groups';
import { ROOM_ICON, roomName, roomSnippet, unread as unreadOf } from '../lib/rooms';
import { ago } from '../lib/time';
import { isOpen, isPinned, SIDE_EMPTY } from '../lib/side';
import { bridgeLine, isoOf, liveDot, shownSessions, stateWord } from '../lib/wbc';
import type { WbcStrings } from '../lib/wbcStrings';
import { shownWbo, wboDot, wboLine, wboWord } from '../lib/wbo';
import type { WboStrings } from '../lib/wboStrings';
import { colors, fonts, gutter, indicatorStyle, radius, space, touch, type } from '../theme/tokens';
import { Avatar } from './Avatar';
import {
  Archive,
  ArchiveRestore,
  ChartColumn,
  Check,
  ChevronRight,
  FolderOpen,
  ListChecks,
  Network,
  RotateCcw,
  Search,
  SquarePen,
  Trash,
  X,
  type LucideIcon,
} from './icons';
import { DrawerRow } from './DrawerRow';
import { StateDot } from './StateDot';
import { GroupHead, SessionGroup, type SessionRowData } from './SessionGroup';
import { SwipeRow, type SwipeAction } from './SwipeRow';
import { Button, ErrorText, Glyph } from './ui';
import { drawerStrings, type DrawerStrings } from '../lib/drawerStrings';
import { uiLang } from '../update/strings';


/** What Select may be asked to do with the conversations it ticks. */
export type BulkWhat = 'archive' | 'unarchive' | 'restore' | 'delete' | 'forever';

const SCOPES: ChatScope[] = ['live', 'archived', 'trash'];

/** Typing stops this long before the server is asked to search what was said. */
const SEARCH_WAIT = 300;

export function DrawerPanel({
  client,
  server,
  user,
  chats,
  error,
  openId,
  onOpen,
  onNew,
  onRefresh,
  onActions,
  onAccount,
  updateNote = null,
  scope = 'live',
  onScope,
  swipeActions,
  onEmptyTrash,
  onBulk,
  onFiles,
  filesOn = false,
  rooms,
  roomsSeen,
  openRoom,
  onRoom,
  orchestrator = null,
  orchOn = false,
  onOrchestrator,
  onAnalytics,
  analyticsOn = false,
  analyticsLabel = 'Analytics',
  accountOn = false,
  wbc = null,
  openWbc = null,
  onWbc,
  wbo = null,
  openWbo = null,
  onWbo,
  side = SIDE_EMPTY,
  onFold,
  onPin,
  lang = 'auto',
}: {
  client: WorkbenchClient | null;
  server: string | null;
  user: User | null;
  chats: Chat[] | null;
  error: string | null;
  openId: string | null;
  onOpen: (chat: Chat) => void;
  onNew: () => void;
  onRefresh: () => Promise<void>;
  onActions: (chat: Chat) => void;
  onAccount: () => void;
  /** "Update ready: 1.5.1" when the server has a newer build: said under the name, with a dot. */
  updateNote?: string | null;
  /** Which conversations the list shows: Chats, Archived or Trash. */
  scope?: ChatScope;
  onScope?: (scope: ChatScope) => void;
  /** The buttons a swipe to the left shows on a row. */
  swipeActions?: (chat: Chat) => SwipeAction[];
  /** Select: what is to be done with every conversation ticked, at once. */
  onBulk?: (chats: Chat[], what: BulkWhat) => void;
  onEmptyTrash?: () => void;
  onFiles?: () => void;
  /** Files is what is open. */
  filesOn?: boolean;
  /** The workspace's rooms, above the conversations. */
  rooms?: Room[] | null;
  /** The room open on screen, if any. */
  openRoom?: RoomId | null;
  onRoom?: (room: RoomId) => void;
  /** When each room was last read on this phone, for counting what is unread. */
  roomsSeen?: Record<string, string>;
  /** The Orchestrator's row, pinned above the rooms (its name and line, in the app's language); null when the server has none. */
  orchestrator?: { label: string; snip: string } | null;
  /** The Orchestrator is open on screen. */
  orchOn?: boolean;
  onOrchestrator?: () => void;
  /** Analytics: the charts of the models, the tools, the Orchestrator and the job pool. */
  onAnalytics?: () => void;
  analyticsOn?: boolean;
  analyticsLabel?: string;
  /** Settings (the account at the foot opens it) is what is open. */
  accountOn?: boolean;
  /** One's own Claude Code sessions (GET /api/wbc/sessions) and their words; null on a server without them. */
  wbc?: { t: WbcStrings; rows: WbcSession[] } | null;
  /** The Claude session open on screen, if any. */
  openWbc?: string | null;
  onWbc?: (sid: string) => void;
  /** One's own OpenCode sessions (GET /api/wbo/sessions) and their words; null on a server without them. */
  wbo?: { t: WboStrings; rows: WboSession[] } | null;
  openWbo?: string | null;
  onWbo?: (sid: string) => void;
  /** The groups' pins and folds (GET /api/me/side), and what changes them. */
  side?: SidePrefs;
  onFold?: (group: FoldGroup, open: boolean) => void;
  onPin?: (group: SideGroup, id: string, pinned: boolean) => void;
  /** The app's language: the drawer's own words follow it. */
  lang?: VoiceLang;
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; scope: ChatScope; chats: Chat[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  /** Select: ticking several conversations, and the ones ticked (the web's .tcv-cc-selbar). */
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState<ReadonlySet<string>>(() => new Set());
  // The server's own days once its trash was listed (X-Trash-Days), else its default.
  const trashDays = client?.chatTrashDays ?? CHAT_TRASH_DAYS;

  const tick = (id: string) =>
    setSel((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allTicked = !!chats?.length && chats.every((c) => sel.has(c.id));
  // The language the app speaks, not the prop it was handed: Settings > Language
  // changes the first while the second stays as it was, and a table memoised on
  // the prop kept the words of the language it started in.
  const ui = uiLang(lang);
  const t = useMemo(() => drawerStrings(ui), [ui]);

  const pickOff = () => {
    setPicking(false);
    setSel(new Set());
  };
  const bulk = (what: BulkWhat) => {
    const picked = (chats ?? []).filter((c) => sel.has(c.id));
    if (!picked.length) return;
    pickOff();
    onBulk?.(picked, what);
  };

  // Titles are searched here at once; what was said in them, by the server once typing pauses.
  useEffect(() => {
    const words = q.trim();
    if (words.length < 2 || !client) return;
    let live = true;
    const t = setTimeout(() => {
      client.listChats(words, scope).then(
        (got) => live && setFound({ q: words, scope, chats: got }),
        // Not found on the server: what the titles matched is all there is.
        () => live && setFound({ q: words, scope, chats: [] }),
      );
    }, SEARCH_WAIT);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, client, scope]);

  const searching = q.trim().length >= 2 && (found?.q !== q.trim() || found?.scope !== scope);
  const sections = useMemo(() => {
    const all = chats ?? [];
    if (!q.trim()) {
      if (scope === 'trash') return all.length ? [{ title: t.deletedFirst, data: all }] : [];
      return groupChats(all).map((g) => ({ title: t.groups[g.name], data: g.chats }));
    }
    const here = filterChats(all, q);
    const there = found && found.q === q.trim() && found.scope === scope ? found.chats : [];
    const seen = new Set(here.map((c) => c.id));
    const data = [...here, ...there.filter((c) => !seen.has(c.id))];
    return data.length ? [{ title: t.results, data }] : [];
  }, [chats, q, found, scope, t]);

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const who = user?.name || user?.email || t.localMode;
  // The connected ones, the last day's and the pinned ones, as on the web; a search narrows them.
  const claude = useMemo<SessionRowData[]>(() => {
    if (!wbc || !onWbc) return [];
    const pins = new Set(side.pins.claude);
    const rows = shownSessions(wbc.rows, q, openWbc);
    // A pinned one stays in the list however long ago it was used (shownSessions keeps the last day's).
    const more = q.trim() ? [] : wbc.rows.filter((x) => pins.has(x.session_id) && !rows.includes(x));
    return [...rows, ...more].map((x) => ({
      id: x.session_id,
      name: x.name,
      note: bridgeLine(x.bridge, wbc.t),
      says: [stateWord(x, wbc.t), x.computer].filter(Boolean).join(' · '),
      when: x.last_ts ? ago(isoOf(x.last_ts), new Date(), uiLang(lang)) : '',
      dot: liveDot(x.bridge),
      live: !!x.bridge?.connected,
    }));
  }, [wbc, onWbc, q, openWbc, side, lang]);
  const opencode = useMemo<SessionRowData[]>(() => {
    if (!wbo || !onWbo) return [];
    return shownWbo(wbo.rows, q, openWbo, (id) => isPinned(side, 'opencode', id)).map((x) => ({
      id: x.session_id,
      name: x.name,
      note: wboLine(x, wbo.t),
      says: [wboWord(x, wbo.t), x.computer].filter(Boolean).join(' · '),
      when: x.updated ? ago(new Date(x.updated).toISOString(), new Date(), uiLang(lang)) : '',
      dot: wboDot(x),
      live: !!x.bridge?.connected,
    }));
  }, [wbo, onWbo, q, openWbo, side, lang]);
  const fold = onFold ?? (() => undefined);
  // The rooms are open until folded by hand (kept as the session groups' folds); folded, their unread is on the header.
  const roomsOpen = isOpen(side, 'rooms', true);
  // Folded, a dot: warn while a room's question waits for an answer, accent while a room has lines not read here.
  const roomsUnread = (rooms ?? []).some((r) => unreadOf(r, roomsSeen?.[r.room]) > 0);
  const roomsWaiting = (rooms ?? []).some((r) => r.waiting > 0);
  const pin = onPin ?? (() => undefined);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left']}>
      {picking ? (
        // Selecting takes the search row's and New chat's place, so the list below does not move (the web's .tcv-cc-selbar).
        <View style={s.pickBar} testID="chat-pickbar">
          <Pressable
            testID="chat-pick-all"
            onPress={() => setSel(allTicked ? new Set() : new Set((chats ?? []).map((c) => c.id)))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allTicked }}
            accessibilityLabel={allTicked ? t.untickAll : t.tickAll}
            style={s.pickAll}
          >
            <View style={[s.pickBox, allTicked && s.pickBoxOn]}>
              {allTicked ? <Glyph icon={Check} size={12} color={colors.inkOnAccent} /> : null}
            </View>
            <Text style={s.pickCount} numberOfLines={1}>
              {sel.size} selected
            </Text>
          </Pressable>
          <View style={s.pickActs}>
            {scope === 'trash' ? (
              <>
                <PickAct icon={RotateCcw} label={t.bulkRestore} testID="chat-bulk-restore" onPress={() => bulk('restore')} />
                <PickAct
                  icon={Trash}
                  label={t.bulkForever}
                  testID="chat-bulk-forever"
                  danger
                  onPress={() => bulk('forever')}
                />
              </>
            ) : (
              <>
                <PickAct
                  icon={scope === 'archived' ? ArchiveRestore : Archive}
                  label={scope === 'archived' ? t.bulkUnarchive : t.bulkArchive}
                  testID={scope === 'archived' ? 'chat-bulk-unarchive' : 'chat-bulk-archive'}
                  onPress={() => bulk(scope === 'archived' ? 'unarchive' : 'archive')}
                />
                <PickAct icon={Trash} label={t.bulkDelete} testID="chat-bulk-delete" danger onPress={() => bulk('delete')} />
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={s.top}>
            <View style={[s.search, focused && s.searchFocused]}>
              <Glyph icon={Search} size={18} color={colors.inkDim} />
              <TextInput
                ref={input}
                testID="drawer-search"
                style={s.searchInput}
                value={q}
                onChangeText={setQ}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={t.search}
                placeholderTextColor={colors.inkDim}
                selectionColor={colors.inkDim}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t.searchChats}
              />
              {q ? (
                <Pressable
                  onPress={() => setQ('')}
                  accessibilityRole="button"
                  accessibilityLabel={t.clearSearch}
                  hitSlop={10}
                  style={s.clear}
                >
                  <Glyph icon={X} size={16} color={colors.inkDim} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable
            testID="new-chat"
            onPress={onNew}
            accessibilityRole="button"
            accessibilityLabel={t.newChat}
            style={s.newRow}
          >
            {({ pressed }) => (
              <>
                <Glyph icon={SquarePen} size={20} color={pressed ? colors.inkDim : colors.ink} />
                <Text style={[s.newText, pressed && s.dimText]}>{t.newChat}</Text>
              </>
            )}
          </Pressable>
        </>
      )}
      {onScope ? (
        // The web's tab row: small tabs at the left, Select at the right (.tcv-cc-tabrow, .tcv-cc-tabs).
        <View style={s.tabRow}>
          <View style={s.tabs} accessibilityRole="tablist">
            {SCOPES.map((id) => {
              const on = id === scope;
              const label = id === 'live' ? t.conversations : id === 'archived' ? t.archived : t.trash;
              return (
                <Pressable
                  key={id}
                  testID={`chat-scope-${id}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  onPress={() => {
                    // Another scope's conversations are another list: nothing ticked carries over.
                    setSel(new Set());
                    onScope(id);
                  }}
                  style={s.tab}
                >
                  {({ pressed }) => (
                    <Text
                      style={[s.tabText, on && s.tabOn, pressed && !on && s.tabPressed]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          {onBulk && chats?.length ? (
            <Pressable
              testID="chat-select"
              onPress={() => (picking ? pickOff() : setPicking(true))}
              accessibilityRole="button"
              accessibilityState={{ selected: picking }}
              accessibilityLabel={picking ? t.doneSelecting : t.selectSeveral}
              hitSlop={8}
              style={[s.selBtn, picking && s.selBtnOn]}
            >
              {({ pressed }) => (
                <>
                  <Glyph icon={ListChecks} size={13} color={picking || pressed ? colors.inkBright : colors.inkDim} />
                  <Text style={[s.selText, picking && s.selTextOn, pressed && !picking && s.tabPressed]}>
                    {picking ? t.done : t.select}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <SectionList
        indicatorStyle={indicatorStyle}
        testID="drawer-list"
        style={s.flex}
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled={false}
        // A drawer is read at a glance: draw a screenful and more at once, not in pieces.
        initialNumToRender={40}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderSectionHeader={({ section }) => <Text style={s.group}>{section.title}</Text>}
        renderItem={({ item }) =>
          // Selecting, a row is a box to tick: no swipe, no opening, the actions are in the bar above.
          picking ? (
            <Row
              chat={item}
              on={false}
              trash={scope === 'trash'}
              check={sel.has(item.id)}
              onPress={() => tick(item.id)}
              t={t}
              lang={lang}
            />
          ) : (
            <SwipeRow actions={swipeActions?.(item) ?? []} testID={`swipe-${item.id}`}>
              <Row
                chat={item}
                on={item.id === openId && !filesOn}
                trash={scope === 'trash'}
                onPress={() => (scope === 'trash' ? onActions(item) : onOpen(item))}
                onLongPress={() => onActions(item)}
                onMore={() => onActions(item)}
                t={t}
                lang={lang}
              />
            </SwipeRow>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.inkDim}
            colors={[colors.ink]}
            progressBackgroundColor={colors.surface2}
          />
        }
        ListHeaderComponent={
          <>
            {/* The rooms lead the list, as they do on the web: the workspace's own
                threads, above the conversations. */}
            {/* The rooms, the Claude sessions and the OpenCode sessions are what is
                live: in Archived and Trash they are not this list's business. */}
            {!picking && scope === 'live' && !q.trim() && ((onRoom && rooms?.length) || (orchestrator && onOrchestrator)) ? (
              <View testID="drawer-rooms">
                <GroupHead
                  label={t.rooms}
                  open={roomsOpen}
                  onPress={() => fold('rooms', !roomsOpen)}
                  hint={roomsOpen ? t.foldsRooms : t.opensRooms}
                  right={
                    roomsOpen ? null : roomsWaiting ? (
                      <View testID="drawer-rooms-dot" accessibilityLabel={t.questionWaits}>
                        <StateDot s="retry" size={7} />
                      </View>
                    ) : roomsUnread ? (
                      <View style={s.news} testID="drawer-rooms-dot" accessibilityLabel={t.unreadSomeone} />
                    ) : null
                  }
                  testID="drawer-rooms-fold"
                />
                {roomsOpen && orchestrator && onOrchestrator ? (
                  <OrchRow label={orchestrator.label} snip={orchestrator.snip} on={orchOn} onPress={onOrchestrator} />
                ) : null}
                {(onRoom && roomsOpen ? (rooms ?? []) : []).map((r) => (
                  <RoomRow
                    key={r.room}
                    room={r}
                    on={r.room === openRoom}
                    unread={unreadOf(r, roomsSeen?.[r.room])}
                    onPress={() => onRoom?.(r.room)}
                    t={t}
                    lang={lang}
                  />
                ))}
              </View>
            ) : null}
            {!picking && scope === 'live' && wbc && onWbc ? (
              <SessionGroup
                group="claude"
                label={wbc.t.group}
                rows={claude}
                prefs={side}
                selected={openWbc}
                searching={!!q.trim()}
                t={wbc.t}
                onOpen={onWbc}
                onFold={fold}
                onPin={pin}
                testID="drawer-wbc"
                prefix="wbc"
              />
            ) : null}
            {!picking && scope === 'live' && wbo && onWbo ? (
              <SessionGroup
                group="opencode"
                label={wbo.t.group}
                rows={opencode}
                prefs={side}
                selected={openWbo}
                searching={!!q.trim()}
                t={wbo.t}
                onOpen={onWbo}
                onFold={fold}
                onPin={pin}
                testID="drawer-wbo"
                prefix="wbo"
              />
            ) : null}
            {error ? (
              <View style={s.note}>
                <ErrorText>{error}</ErrorText>
                <Button label={t.tryAgain} onPress={refresh} testID="chats-retry" />
              </View>
            ) : !picking && scope === 'trash' && chats?.length && !q.trim() && onEmptyTrash ? (
              <View style={s.trashHead}>
                <Text style={s.trashNote}>{t.keptDays(trashDays)}</Text>
                <Button label={t.emptyTrash} variant="danger" onPress={onEmptyTrash} testID="empty-trash" />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          chats === null && !error ? (
            <ActivityIndicator style={s.wait} color={colors.inkDim} accessibilityLabel={t.reading} />
          ) : searching ? (
            <ActivityIndicator style={s.wait} color={colors.inkDim} accessibilityLabel={t.searching} />
          ) : q.trim() ? (
            <Text style={s.empty}>{t.nothingFound(q.trim())}</Text>
          ) : !error ? (
            <Text style={s.empty}>
              {scope === 'trash'
                ? t.emptyTrashDays(trashDays)
                : scope === 'archived'
                  ? t.emptyArchived
                  : t.emptyLive}
            </Text>
          ) : null
        }
        contentContainerStyle={s.listPad}
      />
      {onFiles ? (
        <Pressable
          testID="open-files"
          onPress={onFiles}
          accessibilityRole="button"
          accessibilityLabel={t.files}
          accessibilityState={{ selected: filesOn }}
          style={s.filesRow}
        >
          {({ pressed }) => (
            <>
              <Glyph icon={FolderOpen} size={20} color={pressed ? colors.inkDim : colors.ink} />
              <Text style={[s.newText, filesOn && s.titleOn, pressed && s.dimText]}>{t.files}</Text>
            </>
          )}
        </Pressable>
      ) : null}
      {onAnalytics ? (
        <Pressable
          testID="open-analytics"
          onPress={onAnalytics}
          accessibilityRole="button"
          accessibilityLabel={analyticsLabel}
          accessibilityState={{ selected: analyticsOn }}
          style={s.navRow}
        >
          {({ pressed }) => (
            <>
              <Glyph icon={ChartColumn} size={20} color={pressed ? colors.inkDim : colors.ink} />
              <Text style={[s.newText, analyticsOn && s.titleOn, pressed && s.dimText]}>{analyticsLabel}</Text>
            </>
          )}
        </Pressable>
      ) : null}
      <Pressable
        testID="open-account"
        onPress={onAccount}
        accessibilityRole="button"
        accessibilityLabel={t.account(who, updateNote)}
        accessibilityState={{ selected: accountOn }}
        style={s.account}
      >
        {({ pressed }) => (
          <>
            <Avatar client={client} user={user} size={36} fontSize={type.small}>
              {updateNote ? <View style={s.dot} testID="update-dot" /> : null}
            </Avatar>
            <View style={s.flex}>
              <Text style={[s.name, pressed && s.dimText]} numberOfLines={1}>
                {who}
              </Text>
              {updateNote ? (
                <Text style={s.updateNote} numberOfLines={1} testID="drawer-update">
                  {updateNote}
                </Text>
              ) : (
                <Text style={s.server} numberOfLines={1}>
                  {server ? displayServer(server) : ''}
                </Text>
              )}
            </View>
            <Glyph icon={ChevronRight} size={18} color={colors.inkDim} />
          </>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

/**
 * A room in the drawer: its icon and name, when it was last written in - or
 * how much of it is unread - and the last line, cut at two lines.
 */
function RoomRow({
  room,
  on,
  unread,
  onPress,
  t,
  lang,
}: {
  room: Room;
  on: boolean;
  unread: number;
  onPress: () => void;
  t: DrawerStrings;
  lang: VoiceLang;
}) {
  const Icon = ROOM_ICON[room.room];
  const name = roomName(room.room, uiLang(lang));
  return (
    <Pressable
      testID={`room-${room.room}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={name}
      accessibilityHint={t.roomHint}
      style={s.room}
    >
      {({ pressed }) => (
        <>
          <View style={s.roomIco}>
            <Glyph icon={Icon} size={16} color={pressed ? colors.inkDim : colors.ink} />
          </View>
          <View style={s.roomText}>
            <View style={s.roomTop}>
              <Text style={[s.title, on && s.titleOn, pressed && s.dimText]} numberOfLines={1}>
                {name}
              </Text>
              {unread ? (
                <View
                  style={s.badge}
                  testID={`room-${room.room}-unread`}
                  accessibilityLabel={t.unread(unread)}
                >
                  <Text style={s.badgeText}>{t.newLines(unread)}</Text>
                </View>
              ) : null}
              {room.last ? <Text style={s.when}>{ago(room.last.at, new Date(), uiLang(lang))}</Text> : null}
            </View>
            <Text style={s.snip} numberOfLines={2}>
              {roomSnippet(room, uiLang(lang))}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

/** The Orchestrator, pinned above the rooms: read-only, what one's own agent on the server does. */
function OrchRow({ label, snip, on, onPress }: { label: string; snip: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID="room-orchestrator"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      accessibilityHint={snip}
      style={s.room}
    >
      {({ pressed }) => (
        <>
          <View style={s.roomIco}>
            <Glyph icon={Network} size={16} color={pressed ? colors.inkDim : colors.ink} />
          </View>
          <View style={s.roomText}>
            <Text style={[s.title, on && s.titleOn, pressed && s.dimText]} numberOfLines={1}>
              {label}
            </Text>
            <Text style={s.snip} numberOfLines={1}>
              {snip}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

/** One button of the selection bar: what Select does with what is ticked. */
function PickAct({
  icon,
  label,
  onPress,
  danger,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.pickAct}
    >
      {({ pressed }) => (
        <Glyph icon={icon} size={18} color={danger ? colors.danger : pressed ? colors.inkDim : colors.ink} />
      )}
    </Pressable>
  );
}

/** A conversation: its title and when, what was last said under it - the same
 *  row as the sessions' (DrawerRow). */
function Row({
  chat,
  on,
  trash,
  check,
  onPress,
  onLongPress,
  onMore,
  t,
  lang,
}: {
  chat: Chat;
  on: boolean;
  trash?: boolean;
  /** Selecting several: undefined when not, else whether this one is ticked. */
  check?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onMore?: () => void;
  t: DrawerStrings;
  lang: VoiceLang;
}) {
  return (
    <DrawerRow
      title={chat.title}
      when={
        trash
          ? chat.days_left == null
            ? ''
            : t.dLeft(chat.days_left)
          : rowTime(chat, groupOf(chat), new Date(), uiLang(lang))
      }
      sub={trash ? undefined : chatSnippet(chat, uiLang(lang))}
      check={check}
      on={on}
      onPress={onPress}
      onLongPress={onLongPress}
      onMore={onMore}
      hint={check !== undefined ? t.rowHintTick : trash ? t.rowHintTrash : t.rowHintChat}
      moreLabel={t.actionsFor(chat.title)}
      testID={`chat-${chat.id}`}
    />
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  top: { paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.xs },
  search: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 12,
    borderRadius: radius.field,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.surface2,
  },
  // Focus is told by the hairline getting lighter, as in the composer.
  searchFocused: { borderColor: colors.focus },
  searchInput: {
    flex: 1,
    minHeight: touch - 2,
    fontFamily: fonts.sans,
    fontSize: type.input,
    color: colors.ink,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  clear: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  newRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
  },
  newText: { fontFamily: fonts.sansMedium, fontSize: type.body, color: colors.ink },
  dimText: { color: colors.inkDim },
  // The web's .tcv-cc-tabrow: small tabs at the left, Select at the right.
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 36,
    paddingHorizontal: gutter,
    // The list runs under this row: a hairline, so a row cut off at the top
    // reads as scrolled rather than as broken.
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  // A narrow phone: the tabs give way (a label ends in an ellipsis), Select never does.
  tabs: { flex: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tab: { minWidth: 0, flexShrink: 1, paddingVertical: 8 },
  tabText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  tabOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  tabPressed: { color: colors.ink },
  // .tcv-cc-selbtn: an outlined word at the row's end, bright and bold while selecting.
  selBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 5,
  },
  selBtnOn: { borderColor: colors.focus },
  selText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  selTextOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  // .tcv-cc-selbar: where the search and New chat were, with the boxes and the buttons.
  pickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingLeft: gutter,
    paddingRight: space.sm,
  },
  pickAll: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  pickBox: {
    width: 16,
    height: 16,
    borderRadius: radius.check,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  pickCount: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.ink },
  pickActs: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // A target as big as the finger, drawn small: 36 of mark in the box the row gives.
  pickAct: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  listPad: { paddingBottom: space.lg, flexGrow: 1 },
  // The web's .tcv-cc-group, which the date headings and the groups' heads share.
  group: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: 3,
    fontFamily: fonts.sansMedium,
    fontSize: type.micro,
    color: colors.inkDim,
  },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sansMedium, fontSize: type.row, color: colors.ink },
  titleOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  when: { flexShrink: 0, minWidth: 44, textAlign: 'right', fontFamily: fonts.mono, fontSize: type.micro, color: colors.inkDim },
  // A room is two lines: its name and when, then the last thing said in it.
  room: {
    backgroundColor: colors.surface,
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: gutter,
    paddingVertical: 6,
  },
  roomIco: { width: 16, paddingTop: 1, alignItems: 'center' },
  roomText: { flex: 1, minWidth: 0, gap: 1 },
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  snip: { fontFamily: fonts.sans, fontSize: type.micro, lineHeight: type.microLine, color: colors.inkDim },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  news: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.inkOnAccent },
  note: { paddingHorizontal: gutter, paddingVertical: space.md, gap: space.sm, alignItems: 'flex-start' },
  wait: { marginTop: space.xl },
  empty: {
    paddingHorizontal: gutter,
    paddingTop: space.xl,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
  },
  trashHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingLeft: gutter,
    paddingRight: space.sm,
    paddingTop: space.xs,
  },
  trashNote: { flex: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  filesRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  navRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: gutter },
  account: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.hover,
  },
  avatarText: { fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.ink },
  // An update waiting in Account: a small dot of ink on the avatar's edge, ringed by the drawer's ground.
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.inkBright,
  },
  updateNote: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.ink, marginTop: 1 },
  name: { fontFamily: fonts.sansMedium, fontSize: type.lead, color: colors.ink },
  server: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: 1 },
});
