/** The conversations on this server, newest first (pinned ones on top, as on the web). */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type VoiceLang } from '../api/client';
import { displayServer } from '../api/server';
import type { Chat } from '../api/types';
import { AccountSheet } from '../components/AccountSheet';
import { Header } from '../components/Header';
import { Button, ErrorText } from '../components/ui';
import { shortTime } from '../lib/time';
import { useSession } from '../state/session';
import { colors, fonts, type } from '../theme/tokens';

export function ChatListScreen({
  onOpen,
  lang,
  onLang,
}: {
  onOpen: (chat: Chat) => void;
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
}) {
  const { client, server } = useSession();
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [account, setAccount] = useState(false);

  const load = useCallback(() => {
    if (!client) return Promise.resolve();
    return client.listChats().then(
      (got) => {
        setChats(got);
        setError(null);
      },
      (e) => setError(e instanceof ApiError ? e.message : 'The conversations could not be read.'),
    );
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const create = async () => {
    if (!client) return;
    setCreating(true);
    try {
      const chat = await client.createChat();
      onOpen(chat);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'A new conversation could not be started.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right']}>
      <Header
        title="Chat"
        sub={server ? displayServer(server) : undefined}
        right={
          <>
            <Button label="Account" variant="quiet" onPress={() => setAccount(true)} testID="open-account" />
            <Button label="New" variant="primary" busy={creating} onPress={create} testID="new-chat" />
          </>
        }
      />
      {error ? (
        <View style={st.error}>
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}
      <FlatList
        data={chats ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <Row chat={item} onPress={() => onOpen(item)} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.inkDim}
            colors={[colors.ink]}
            progressBackgroundColor={colors.surface2}
          />
        }
        ListEmptyComponent={
          chats ? (
            <View style={st.empty}>
              <Text style={st.emptyTitle}>No conversations yet</Text>
              <Text style={st.emptyText}>Start one with New. Conversations made on the web show here too.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={st.listPad}
      />
      {account ? <AccountSheet onClose={() => setAccount(false)} lang={lang} onLang={onLang} /> : null}
    </SafeAreaView>
  );
}

function Row({ chat, onPress }: { chat: Chat; onPress: () => void }) {
  const last = chat.last?.text?.replace(/\s+/g, ' ').trim();
  const who = chat.last?.role === 'user' && chat.last.by ? `${chat.last.by}: ` : '';
  return (
    <Pressable
      testID={`chat-${chat.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${chat.title}${last ? `. ${last}` : ''}`}
      style={({ pressed }) => [st.row, pressed && st.pressed]}
    >
      <View style={st.rowTop}>
        <Text style={st.title} numberOfLines={1}>
          {chat.title}
        </Text>
        <Text style={st.when}>{shortTime(chat.updated_at)}</Text>
      </View>
      <Text style={st.last} numberOfLines={1}>
        {last ? who + last : 'No lines yet'}
      </Text>
      <Text style={st.meta} numberOfLines={1}>
        {[chat.pinned ? 'Pinned' : null, chat.model, `${chat.count} ${chat.count === 1 ? 'line' : 'lines'}`]
          .filter(Boolean)
          .join('  ·  ')}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  error: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  listPad: { paddingBottom: 24 },
  row: { paddingHorizontal: 16, paddingVertical: 12, gap: 3, borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { backgroundColor: colors.hover },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  title: { flex: 1, fontFamily: fonts.sansMedium, fontSize: type.body, color: colors.ink },
  when: { fontFamily: fonts.mono, fontSize: type.tiny - 1, color: colors.inkDim },
  last: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  meta: { fontFamily: fonts.mono, fontSize: type.tiny - 1, color: colors.inkDim },
  empty: { padding: 32, gap: 6, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.sansSemi, fontSize: type.body, color: colors.ink },
  emptyText: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim, textAlign: 'center', lineHeight: 20 },
});
