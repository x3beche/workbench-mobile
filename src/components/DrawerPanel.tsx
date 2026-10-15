/**
 * What the drawer holds: search and New chat at the top, the conversations
 * by day (one line each, the open one in heavier, brighter ink), and the
 * account at the bottom, which opens Account.
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

import type { WorkbenchClient } from '../api/client';
import { displayServer } from '../api/server';
import type { Chat, User } from '../api/types';
import { filterChats, groupChats, groupOf, initials, rowTime } from '../lib/groups';
import { colors, fonts, gutter, radius, space, touch, type } from '../theme/tokens';
import { ChevronRight, Search, SquarePen, X } from './icons';
import { Button, ErrorText, Glyph } from './ui';

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
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; chats: Chat[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);

  // Titles are searched here at once; what was said in them, by the server once typing pauses.
  useEffect(() => {
    const words = q.trim();
    if (words.length < 2 || !client) return;
    let live = true;
    const t = setTimeout(() => {
      client.listChats(words).then(
        (got) => live && setFound({ q: words, chats: got }),
        // Not found on the server: what the titles matched is all there is.
        () => live && setFound({ q: words, chats: [] }),
      );
    }, SEARCH_WAIT);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, client]);

  const searching = q.trim().length >= 2 && found?.q !== q.trim();
  const sections = useMemo(() => {
    const all = chats ?? [];
    if (!q.trim()) return groupChats(all).map((g) => ({ title: g.name as string, data: g.chats }));
    const here = filterChats(all, q);
    const there = found && found.q === q.trim() ? found.chats : [];
    const seen = new Set(here.map((c) => c.id));
    const data = [...here, ...there.filter((c) => !seen.has(c.id))];
    return data.length ? [{ title: 'Results', data }] : [];
  }, [chats, q, found]);

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
      <SectionList
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
          <Row chat={item} on={item.id === openId} onPress={() => onOpen(item)} onLongPress={() => onActions(item)} />
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
          error ? (
            <View style={s.note}>
              <ErrorText>{error}</ErrorText>
              <Button label="Try again" onPress={refresh} testID="chats-retry" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          chats === null && !error ? (
            <ActivityIndicator style={s.wait} color={colors.inkDim} accessibilityLabel="Reading the conversations" />
          ) : searching ? (
            <ActivityIndicator style={s.wait} color={colors.inkDim} accessibilityLabel="Searching" />
          ) : q.trim() ? (
            <Text style={s.empty}>Nothing found for “{q.trim()}”.</Text>
          ) : !error ? (
            <Text style={s.empty}>No conversations yet. Conversations started on the web show here too.</Text>
          ) : null
        }
        contentContainerStyle={s.listPad}
      />
      <Pressable
        testID="open-account"
        onPress={onAccount}
        accessibilityRole="button"
        accessibilityLabel={`Account: ${who}`}
        style={s.account}
      >
        {({ pressed }) => (
          <>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials(user?.name || user?.email)}</Text>
            </View>
            <View style={s.flex}>
              <Text style={[s.name, pressed && s.dimText]} numberOfLines={1}>
                {who}
              </Text>
              <Text style={s.server} numberOfLines={1}>
                {server ? displayServer(server) : ''}
              </Text>
            </View>
            <Glyph icon={ChevronRight} size={18} color={colors.inkDim} />
          </>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

function Row({
  chat,
  on,
  onPress,
  onLongPress,
}: {
  chat: Chat;
  on: boolean;
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
      accessibilityHint="Long press for rename, archive and delete"
      style={s.row}
    >
      {({ pressed }) => (
        <>
          <Text style={[s.title, on && s.titleOn, pressed && s.dimText]} numberOfLines={1}>
            {chat.title}
          </Text>
          <Text style={s.when}>{rowTime(chat, groupOf(chat))}</Text>
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
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
  },
  title: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  titleOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  when: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
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
  name: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink },
  server: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: 1 },
});
