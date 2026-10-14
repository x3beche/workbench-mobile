/**
 * One conversation: its lines, the answer being written, and the composer.
 * A line sent is answered on the stream that sent it; a conversation opened
 * while someone's answer is being written follows it on GET /live.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type VoiceLang } from '../api/client';
import type { Chat, ChatEvent, ChatMessage } from '../api/types';
import { Composer } from '../components/Composer';
import { Header } from '../components/Header';
import { MessageItem, WritingItem } from '../components/MessageItem';
import { ModelSheet } from '../components/ModelSheet';
import { Button, ErrorText } from '../components/ui';
import { VoiceNoteSheet } from '../components/VoiceNoteSheet';
import { applyEvent, type ConversationView } from '../lib/answer';
import { useSession } from '../state/session';
import { colors, fonts, type } from '../theme/tokens';

type Action = { kind: 'load'; chat: Chat } | { kind: 'event'; ev: ChatEvent };

function reducer(view: ConversationView, a: Action): ConversationView {
  if (a.kind === 'load') {
    return { title: a.chat.title, messages: a.chat.messages ?? [], writing: a.chat.gen ? view.writing : null, stale: false };
  }
  return applyEvent(view, a.ev);
}

/** This app's own name on the stream, so its answer can be told from others'. */
const CLIENT = `mobile-${Math.random().toString(36).slice(2, 10)}`;

export function ChatScreen({ initial, onBack, lang }: { initial: Chat; onBack: () => void; lang: VoiceLang }) {
  const { client, user } = useSession();
  const [chat, setChat] = useState<Chat>(initial);
  const [view, dispatch] = useReducer(reducer, {
    title: initial.title,
    messages: initial.messages ?? [],
    writing: null,
    stale: false,
  });
  const [loaded, setLoaded] = useState(!!initial.messages);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [models, setModels] = useState(false);
  const [voiceNote, setVoiceNote] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  const streams = useRef(new Set<AbortController>());
  const mounted = useRef(true);
  const loadRef = useRef<() => void>(() => undefined);

  useEffect(
    () => () => {
      mounted.current = false;
      streams.current.forEach((c) => c.abort());
    },
    [],
  );

  const follow = useCallback(async () => {
    if (!client) return;
    const ctl = new AbortController();
    streams.current.add(ctl);
    try {
      await client.live(initial.id, { onEvent: (ev) => dispatch({ kind: 'event', ev }), signal: ctl.signal });
    } catch {
      // The stream went (a network change, the server closing it): reading the conversation is enough.
    } finally {
      streams.current.delete(ctl);
    }
  }, [client, initial.id]);

  const load = useCallback(() => {
    if (!client) return Promise.resolve();
    return client.getChat(initial.id).then(
      (got) => {
        if (!mounted.current) return;
        setChat(got);
        dispatch({ kind: 'load', chat: got });
        setLoaded(true);
        setError(null);
        // Someone's answer is being written: follow it, then read the result.
        if (got.gen && !streams.current.size) {
          follow().then(() => {
            if (mounted.current) loadRef.current();
          });
        }
      },
      (e) => setError(e instanceof ApiError ? e.message : 'The conversation could not be read.'),
    );
  }, [client, initial.id, follow]);

  useEffect(() => {
    loadRef.current = load;
    load();
  }, [load]);

  // Pieces were missed, or an answer ended without its line: read it again.
  useEffect(() => {
    if (view.stale) load();
  }, [view.stale, load]);

  const send = async (text: string): Promise<boolean> => {
    if (!client) return false;
    setError(null);
    setNotice(null);
    const ctl = new AbortController();
    streams.current.add(ctl);
    try {
      const got = await client.say(
        initial.id,
        { text, provider: chat.provider, model: chat.model, client: CLIENT },
        { onEvent: (ev) => dispatch({ kind: 'event', ev }), signal: ctl.signal },
      );
      if (got.queued) {
        setNotice('An answer is being written. Your message waits and is sent after it.');
        load();
      }
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true;
      setError(e instanceof ApiError ? e.message : 'The message could not be sent.');
      load();
      return false;
    } finally {
      streams.current.delete(ctl);
      if (mounted.current) setTimeout(() => mounted.current && !streams.current.size && load(), 300);
    }
  };

  const stop = async () => {
    try {
      await client?.stop(initial.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The answer could not be stopped.');
    }
  };

  const pickModel = async (provider: string, model: string) => {
    if (!client) return;
    const got = await client.setModel(initial.id, provider, model);
    setChat(got);
  };

  // After the frame that laid the new content out (the footer, an answer
  // being written, is measured late on the web).
  const toEnd = () => setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Header
        title={view.title}
        sub={chat.model}
        left={<Button label="Back" variant="quiet" onPress={onBack} testID="back" />}
        right={
          <>
            <Button label="Model" variant="quiet" onPress={() => setModels(true)} testID="open-models" />
            <Button label="Voice note" variant="quiet" onPress={() => setVoiceNote(true)} testID="open-voice-note" />
          </>
        }
      />
      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={view.messages}
          keyExtractor={(m, i) => m.id || String(i)}
          renderItem={({ item }) => <MessageItem m={item} mine={!!user && item.by?.id === user.id} />}
          onContentSizeChange={toEnd}
          // The composer growing or the keyboard opening shrinks the list: keep the newest line in view.
          onLayout={toEnd}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.inkDim} colors={[colors.ink]} progressBackgroundColor={colors.surface2} />}
          ListEmptyComponent={
            loaded && !view.writing ? (
              <View style={st.empty}>
                <Text style={st.emptyTitle}>A new conversation</Text>
                <Text style={st.emptyText}>Ask anything. The answer is written by {chat.model || 'the server’s chat model'}.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={view.writing ? <WritingItem w={view.writing} model={chat.model} /> : null}
          contentContainerStyle={st.listPad}
        />
        {error || notice ? (
          <View style={st.msg}>{error ? <ErrorText>{error}</ErrorText> : <Text style={st.notice}>{notice}</Text>}</View>
        ) : null}
        <Composer client={client} lang={lang} writing={!!view.writing} onSend={send} onStop={stop} />
      </KeyboardAvoidingView>
      {models ? (
        <ModelSheet
          client={client}
          provider={chat.provider}
          model={chat.model}
          onClose={() => setModels(false)}
          onPick={pickModel}
        />
      ) : null}
      {voiceNote ? (
        <VoiceNoteSheet client={client} lang={lang} onClose={() => setVoiceNote(false)} onSend={send} />
      ) : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  listPad: { paddingVertical: 8, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 6 },
  emptyTitle: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  emptyText: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 20, color: colors.inkDim, textAlign: 'center' },
  msg: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  notice: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
});
