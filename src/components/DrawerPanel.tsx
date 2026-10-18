/**
 * What the drawer holds: search and New chat at the top, then the workspace's
 * rooms (3D Drawing, PCB Design, Firmware) with their last line, then Chats,
 * Archived and Trash as three tabs over the conversations (by day, one line
 * each, the open one in heavier, brighter ink). A swipe to the left on a
 * row shows its buttons (Archive and Delete; Unarchive; Restore and Delete
 * forever in the trash). At the bottom: Files, and the account, which opens
 * Account - with a dot and the two versions when an update is ready there.
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

import { CHAT_TRASH_DAYS, type WorkbenchClient } from '../api/client';
import { displayServer } from '../api/server';
import type { Chat, ChatScope, Room, RoomId, User } from '../api/types';
import { filterChats, groupChats, groupOf, initials, rowTime } from '../lib/groups';
import { ROOM_ICON, ROOM_LABEL, roomSnippet, unread as unreadOf } from '../lib/rooms';
import { shortTime } from '../lib/time';
import { colors, fonts, gutter, radius, space, touch, type } from '../theme/tokens';
import { ChevronRight, FolderOpen, Search, SquarePen, X } from './icons';
import { SwipeRow, type SwipeAction } from './SwipeRow';
import { Tabs } from './Tabs';
import { Button, ErrorText, Glyph } from './ui';

const SCOPES: { id: ChatScope; label: string }[] = [
  { id: 'live', label: 'Chats' },
  { id: 'archived', label: 'Archived' },
  { id: 'trash', label: 'Trash' },
];

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
  onFiles,
  filesOn = false,
  rooms,
  roomsSeen,
  openRoom,
  onRoom,
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
  /** "Update 1.4.0 → 1.5.0" when the server has a newer build: said under the name, with a dot. */
  updateNote?: string | null;
  /** Which conversations the list shows: Chats, Archived or Trash. */
  scope?: ChatScope;
  onScope?: (scope: ChatScope) => void;
  /** The buttons a swipe to the left shows on a row. */
  swipeActions?: (chat: Chat) => SwipeAction[];
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
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; scope: ChatScope; chats: Chat[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  // The server's own days once its trash was listed (X-Trash-Days), else its default.
  const trashDays = client?.chatTrashDays ?? CHAT_TRASH_DAYS;

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
      if (scope === 'trash') return all.length ? [{ title: 'Deleted, newest first', data: all }] : [];
      return groupChats(all).map((g) => ({ title: g.name as string, data: g.chats }));
    }
    const here = filterChats(all, q);
    const there = found && found.q === q.trim() && found.scope === scope ? found.chats : [];
    const seen = new Set(here.map((c) => c.id));
    const data = [...here, ...there.filter((c) => !seen.has(c.id))];
    return data.length ? [{ title: 'Results', data }] : [];
  }, [chats, q, found, scope]);

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const who = user?.name || user?.email || 'Local mode';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left']}>
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
            placeholder="Search"
            placeholderTextColor={colors.inkDim}
            selectionColor={colors.inkDim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search the conversations"
          />
          {q ? (
            <Pressable
              onPress={() => setQ('')}
              accessibilityRole="button"
              accessibilityLabel="Clear the search"
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
        accessibilityLabel="New chat"
        style={s.newRow}
      >
        {({ pressed }) => (
          <>
            <Glyph icon={SquarePen} size={20} color={pressed ? colors.inkDim : colors.ink} />
            <Text style={[s.newText, pressed && s.dimText]}>New chat</Text>
          </>
        )}
      </Pressable>
      {onScope ? <Tabs tabs={SCOPES} value={scope} onChange={onScope} testID="chat-scope" /> : null}
      <SectionList
        indicatorStyle="white"
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
        renderItem={({ item }) => (
          <SwipeRow actions={swipeActions?.(item) ?? []} testID={`swipe-${item.id}`}>
            <Row
              chat={item}
              on={item.id === openId && !filesOn}
              trash={scope === 'trash'}
              onPress={() => (scope === 'trash' ? onActions(item) : onOpen(item))}
              onLongPress={() => onActions(item)}
            />
          </SwipeRow>
        )}
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
            {!q.trim() && onRoom && rooms?.length ? (
              <View testID="drawer-rooms">
                <Text style={s.group}>Rooms</Text>
                {rooms.map((r) => (
                  <RoomRow
                    key={r.room}
                    room={r}
                    on={r.room === openRoom}
                    unread={unreadOf(r, roomsSeen?.[r.room])}
                    onPress={() => onRoom(r.room)}
                  />
                ))}
              </View>
            ) : null}
            {error ? (
              <View style={s.note}>
                <ErrorText>{error}</ErrorText>
                <Button label="Try again" onPress={refresh} testID="chats-retry" />
              </View>
            ) : scope === 'trash' && chats?.length && !q.trim() && onEmptyTrash ? (
              <View style={s.trashHead}>
                <Text style={s.trashNote}>Kept {trashDays} days, then deleted for good.</Text>
                <Button label="Empty trash" variant="danger" onPress={onEmptyTrash} testID="empty-trash" />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          chats === null && !error ? (
            <ActivityIndicator style={s.wait} color={colors.inkDim} accessibilityLabel="Reading the conversations" />
          ) : searching ? (
            <ActivityIndicator style={s.wait} color={colors.inkDim} accessibilityLabel="Searching" />
          ) : q.trim() ? (
            <Text style={s.empty}>Nothing found for “{q.trim()}”.</Text>
          ) : !error ? (
            <Text style={s.empty}>
              {scope === 'trash'
                ? `The trash is empty. Deleted conversations stay here ${trashDays} days.`
                : scope === 'archived'
                  ? 'Nothing archived. A swipe to the left on a conversation archives it.'
                  : 'No conversations yet. Conversations started on the web show here too.'}
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
          accessibilityLabel="Files"
          accessibilityState={{ selected: filesOn }}
          style={s.filesRow}
        >
          {({ pressed }) => (
            <>
              <Glyph icon={FolderOpen} size={20} color={pressed ? colors.inkDim : colors.ink} />
              <Text style={[s.newText, filesOn && s.titleOn, pressed && s.dimText]}>Files</Text>
            </>
          )}
        </Pressable>
      ) : null}
      <Pressable
        testID="open-account"
        onPress={onAccount}
        accessibilityRole="button"
        accessibilityLabel={`Account: ${who}${updateNote ? `. ${updateNote}` : ''}`}
        style={s.account}
      >
        {({ pressed }) => (
          <>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials(user?.name || user?.email)}</Text>
              {updateNote ? <View style={s.dot} testID="update-dot" /> : null}
            </View>
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
function RoomRow({ room, on, unread, onPress }: { room: Room; on: boolean; unread: number; onPress: () => void }) {
  const Icon = ROOM_ICON[room.room];
  return (
    <Pressable
      testID={`room-${room.room}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={ROOM_LABEL[room.room]}
      accessibilityHint="The agent's own thread for this room"
      style={s.room}
    >
      {({ pressed }) => (
        <>
          <View style={s.roomIco}>
            <Glyph icon={Icon} size={20} color={pressed ? colors.inkDim : colors.ink} />
          </View>
          <View style={s.roomText}>
            <View style={s.roomTop}>
              <Text style={[s.title, on && s.titleOn, pressed && s.dimText]} numberOfLines={1}>
                {ROOM_LABEL[room.room]}
              </Text>
              {unread ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : room.last ? (
                <Text style={s.when}>{shortTime(room.last.at)}</Text>
              ) : null}
            </View>
            <Text style={s.snip} numberOfLines={2}>
              {roomSnippet(room)}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

function Row({
  chat,
  on,
  trash,
  onPress,
  onLongPress,
}: {
  chat: Chat;
  on: boolean;
  trash?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      testID={`chat-${chat.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={chat.title}
      accessibilityHint={
        trash ? 'Restore or delete forever' : 'Swipe left, or long press, for archive, delete and more'
      }
      style={s.row}
    >
      {({ pressed }) => (
        <>
          <Text style={[s.title, on && s.titleOn, pressed && s.dimText]} numberOfLines={1}>
            {chat.title}
          </Text>
          <Text style={s.when}>
            {trash ? (chat.days_left == null ? '' : `${chat.days_left} d left`) : rowTime(chat, groupOf(chat))}
          </Text>
        </>
      )}
    </Pressable>
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
  searchFocused: { borderColor: colors.pressed },
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
  listPad: { paddingBottom: space.lg, flexGrow: 1 },
  group: {
    paddingHorizontal: gutter,
    paddingTop: space.lg + 2,
    paddingBottom: space.xs + 2,
    fontFamily: fonts.sansMedium,
    fontSize: type.tiny,
    color: colors.inkDim,
  },
  row: {
    backgroundColor: colors.surface,
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
  },
  title: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  titleOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  when: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  // A room is two lines: its name and when, then the last thing said in it.
  room: {
    backgroundColor: colors.surface,
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: gutter,
    paddingVertical: space.sm + 2,
  },
  roomIco: { width: 20, paddingTop: 2, alignItems: 'center' },
  roomText: { flex: 1, minWidth: 0, gap: 3 },
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  snip: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  badgeText: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.inkOnAccent },
  note: { paddingHorizontal: gutter, paddingVertical: space.md, gap: space.sm, alignItems: 'flex-start' },
  wait: { marginTop: space.xl },
  empty: {
    paddingHorizontal: gutter,
    paddingTop: space.xl,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: 20,
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
  name: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink },
  server: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: 1 },
});
