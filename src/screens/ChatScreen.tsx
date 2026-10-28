/**
 * One conversation - or a new one, not yet on the server: its lines, the
 * answer being written, and the composer. A new conversation is made on the
 * server when its first line is sent. A line sent is answered on the stream
 * that sent it; a conversation opened while someone's answer is being
 * written follows it on GET /live. Where the server has live streams (S2),
 * the conversation's own stream `chat-<id>` brings the same pieces sooner
 * and is taken first (lib/answer.ts applyPiece), and the account's bus
 * (`cc`) says when the conversation changed elsewhere: it is read again.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type VoiceLang } from '../api/client';
import type { Chat, ChatEvent, ChatMessage } from '../api/types';
import { Appear } from '../components/Appear';
import { ChatHeader } from '../components/ChatHeader';
import { Composer, type ComposerHandle } from '../components/Composer';
import { ArrowDown, ChevronDown, Copy, Ellipsis, SquarePen, TextSelect } from '../components/icons';
import { KeyboardSpacer } from '../components/KeyboardSpacer';
import { Mark } from '../components/Mark';
import { MessageItem, modelName, PendingItem, WritingItem } from '../components/MessageItem';
import { ModelSheet } from '../components/ModelSheet';
import { ActionList, Sheet } from '../components/Sheet';
import { ErrorText, Glyph, IconButton, Button } from '../components/ui';
import { VoiceNoteSheet } from '../components/VoiceNoteSheet';
import { applyEvent, applyPiece, type ConversationView } from '../lib/answer';
import { chatDetailStrings } from '../lib/chatDetail';
import { copy } from '../lib/feel';
import { greeting } from '../lib/groups';
import { useBus, useLive } from '../live/LiveContext';
import { useSession } from '../state/session';
import { colors, fonts, gutter, motion, radius, space, touch, type } from '../theme/tokens';
import { uiLang } from '../update/strings';
import type { VoiceMode } from '../voice/voice';

type Action = { kind: 'load'; chat: Chat } | { kind: 'event'; ev: ChatEvent } | { kind: 'piece'; ev: ChatEvent };

function reducer(view: ConversationView, a: Action): ConversationView {
  if (a.kind === 'load') {
    return {
      title: a.chat.title,
      messages: a.chat.messages ?? [],
      writing: a.chat.gen ? view.writing : null,
      stale: false,
    };
  }
  if (a.kind === 'piece') return applyPiece(view, a.ev);
  return applyEvent(view, a.ev);
}

/** A conversation's S2 stream name; null for an id the gate's names cannot hold (left to /live alone). */
export function laneOf(id: string | null): string | null {
  const name = id ? `chat-${id.toLowerCase()}` : '';
  return /^chat-[a-z0-9][a-z0-9_-]{0,58}$/.test(name) ? name : null;
}

/** Closer to the end than this counts as being at the end: the list follows new lines. */
export const END_SLACK = 72;

/** This app's own name on the stream, so its answer can be told from others'. */
const CLIENT = `mobile-${Math.random().toString(36).slice(2, 10)}`;

export interface Suggestion {
  /** What it is about ("PCB", "Firmware"), small above it. */
  area?: string;
  text: string;
}

export function ChatScreen({
  initial,
  start,
  suggestions = [],
  wide = false,
  lang,
  voiceMode = 'record',
  onMenu,
  onNew,
  onCreated,
  onChanged,
  onGone,
  onMore,
}: {
  /** The conversation to show, or null for a new one. */
  initial: Chat | null;
  /** The model a new conversation begins with. */
  start?: { provider: string; model: string } | null;
  suggestions?: Suggestion[];
  /** The drawer is a column beside it: no button for it. */
  wide?: boolean;
  lang: VoiceLang;
  /** When dictated words appear: while speaking or after recording. */
  voiceMode?: VoiceMode;
  onMenu?: () => void;
  onNew?: () => void;
  /** The new conversation is on the server now. */
  onCreated?: (chat: Chat) => void;
  /** Something the list shows changed (a line, a title). */
  onChanged?: () => void;
  /** The conversation is not on the server (any more). */
  onGone?: () => void;
  /** The "…" in the top bar: rename, pin, archive, export, delete (once it is on the server). */
  onMore?: (chat: { id: string; title: string }) => void;
}) {
  const { client, user } = useSession();
  /** The detail setting's words, in the app's language. */
  const dw = chatDetailStrings(uiLang(lang));
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const idRef = useRef(id);
  idRef.current = id;
  const [model, setModel] = useState({
    provider: initial?.provider || start?.provider || '',
    model: initial?.model || start?.model || '',
  });
  const [view, dispatch] = useReducer(reducer, {
    title: initial?.title ?? '',
    messages: initial?.messages ?? [],
    writing: null,
    stale: false,
  });
  const [loaded, setLoaded] = useState(!initial || !!initial.messages);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [models, setModels] = useState(false);
  const [voiceNote, setVoiceNote] = useState(false);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  // Following the end: new lines and the answer being written scroll into
  // view, until the person scrolls up to read; then a control brings them back.
  const atEnd = useRef(true);
  const lastY = useRef(0);
  const [away, setAway] = useState(false);
  // Scrolled under the top bar: a hairline sets the bar off from the lines.
  const [under, setUnder] = useState(false);
  const streams = useRef(new Set<AbortController>());
  const mounted = useRef(true);
  const loadRef = useRef<() => void>(() => undefined);
  // Lines that came on this app's own stream (or were there when it opened)
  // are drawn without a fade: only lines from elsewhere fade in.
  const seen = useRef<Set<string> | null>(initial?.messages ? new Set(initial.messages.map((m) => m.id)) : null);

  useEffect(
    () => () => {
      mounted.current = false;
      streams.current.forEach((c) => c.abort());
    },
    [],
  );

  // A new conversation takes the server's starting model once it is known.
  useEffect(() => {
    if (!idRef.current && start?.model) setModel((now) => (now.model ? now : { ...start }));
  }, [start]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const onEvent = useCallback((ev: ChatEvent) => {
    if (ev.type === 'user') setPending(null);
    if ((ev.type === 'user' || ev.type === 'done') && ev.message?.id) seen.current?.add(ev.message.id);
    dispatch({ kind: 'event', ev });
  }, []);

  const follow = useCallback(async () => {
    const cid = idRef.current;
    if (!client || !cid) return;
    const ctl = new AbortController();
    streams.current.add(ctl);
    try {
      await client.live(cid, { onEvent, signal: ctl.signal });
    } catch {
      // The stream went (a network change, the server closing it): reading the conversation is enough.
    } finally {
      streams.current.delete(ctl);
    }
  }, [client, onEvent]);

  const load = useCallback(() => {
    const cid = idRef.current;
    if (!client || !cid) return Promise.resolve();
    return client.getChat(cid).then(
      (got) => {
        if (!mounted.current || idRef.current !== cid) return;
        if (!seen.current) seen.current = new Set((got.messages ?? []).map((m) => m.id));
        setModel({ provider: got.provider, model: got.model });
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
      (e) => {
        if (e instanceof ApiError && e.status === 404) {
          onGone?.();
          return;
        }
        setError(e instanceof ApiError ? e.message : 'The conversation could not be read.');
      },
    );
  }, [client, follow, onGone]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // The conversation's own S2 stream, while it is open: the answer's pieces as they are written.
  const hub = useLive();
  useEffect(() => {
    const name = laneOf(id);
    if (!hub || !client || !name) return;
    const lane = hub.follow<ChatEvent>((ev) => dispatch({ kind: 'piece', ev }), {
      stream: name,
      every: true,
      fromTail: true,
      prepare: () => client.s2Streams([name]),
    });
    lane.start();
    return () => hub.drop(lane);
  }, [hub, client, id]);

  // Changed elsewhere (another device, someone of the space): read again - unless this
  // app's own stream is writing it, which says all of it.
  const busSoon = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (busSoon.current) clearTimeout(busSoon.current);
    },
    [],
  );
  useBus(['cc'], (e) => {
    const cid = idRef.current;
    if (!cid || e.k === '$down' || streams.current.size) return;
    if (e.k === 'cc' && (e.p as { id?: string | null } | undefined)?.id !== cid) return;
    if (busSoon.current) return;
    busSoon.current = setTimeout(() => {
      busSoon.current = null;
      if (mounted.current && !streams.current.size) loadRef.current();
    }, 120);
  });

  // Read it once when it opens (a new one has nothing to read).
  useEffect(() => {
    if (initial) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pieces were missed, or an answer ended without its line: read it again.
  useEffect(() => {
    if (view.stale) load();
  }, [view.stale, load]);

  const send = async (text: string): Promise<boolean> => {
    if (!client) return false;
    followEnd();
    setError(null);
    setNotice(null);
    setPending(text);
    let cid = idRef.current;
    if (!cid) {
      try {
        const made = await client.createChat(model.provider || undefined, model.model || undefined);
        if (!mounted.current) return true;
        cid = made.id;
        idRef.current = cid;
        setId(cid);
        seen.current = new Set();
        setModel({ provider: made.provider, model: made.model });
        dispatch({ kind: 'load', chat: { ...made, messages: [] } });
        onCreated?.(made);
      } catch (e) {
        setPending(null);
        setError(e instanceof ApiError ? e.message : 'A new conversation could not be started.');
        return false;
      }
    }
    const ctl = new AbortController();
    streams.current.add(ctl);
    try {
      const got = await client.say(
        cid,
        { text, provider: model.provider || undefined, model: model.model || undefined, client: CLIENT },
        { onEvent, signal: ctl.signal },
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
      if (mounted.current) {
        setPending(null);
        setTimeout(() => mounted.current && !streams.current.size && load(), 300);
        onChanged?.();
      }
    }
  };

  const stop = async () => {
    const cid = idRef.current;
    if (!cid) return;
    try {
      await client?.stop(cid);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The answer could not be stopped.');
    }
  };

  const pickModel = async (provider: string, m: string) => {
    const cid = idRef.current;
    if (!client) return;
    if (!cid) {
      setModel({ provider, model: m });
      return;
    }
    const got = await client.setModel(cid, provider, m);
    setModel({ provider: got.provider, model: got.model });
  };

  // After the frame that laid the new content out (the footer, an answer
  // being written, is measured late on the web).
  const toEnd = () => {
    if (!atEnd.current) return;
    setTimeout(() => atEnd.current && list.current?.scrollToEnd({ animated: false }), 50);
  };

  function followEnd(animated = false) {
    atEnd.current = true;
    setAway(false);
    setTimeout(() => list.current?.scrollToEnd({ animated }), 50);
  }

  // Only a move up leaves the end: the content growing, or the list getting
  // shorter for the keyboard, never does.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    if (y > 4 !== under) setUnder(y > 4);
    const left = contentSize.height - layoutMeasurement.height - y;
    if (left <= END_SLACK) {
      if (!atEnd.current) {
        atEnd.current = true;
        setAway(false);
      }
    } else if (y < lastY.current - 2 && atEnd.current) {
      atEnd.current = false;
      setAway(true);
    }
    lastY.current = y;
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const empty = loaded && !view.messages.length && !view.writing && !pending;
  const who = user?.name?.split(/\s+/)[0];

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']} testID="chat-screen">
      <ChatHeader
        title={view.title || 'New chat'}
        lang={lang}
        client={client}
        wide={wide}
        onMenu={onMenu}
        under={under}
        titleTestID="chat-title"
        sub={
          <Pressable
            testID="open-models"
            onPress={() => setModels(true)}
            accessibilityRole="button"
            accessibilityLabel={`Model: ${model.model || 'the server’s default'}. Choose another`}
            style={({ pressed }) => [st.pill, pressed && st.pillPressed]}
          >
            <Text style={st.pillText} numberOfLines={1}>
              {modelName(model.model) || 'Model'}
            </Text>
            <Glyph icon={ChevronDown} size={13} color={colors.inkDim} />
          </Pressable>
        }
        // As wide as the two buttons on the right, so the name sits in the middle.
        left={onMore ? <View style={st.side} /> : null}
        right={
          <>
            {onMore ? (
              <IconButton
                icon={Ellipsis}
                label="More: rename, pin, archive, export, delete"
                onPress={() => id && onMore({ id, title: view.title })}
                testID="header-more"
                disabled={!id}
              />
            ) : null}
            {onNew ? (
              <IconButton icon={SquarePen} label="New chat" onPress={onNew} testID="header-new-chat" disabled={empty} />
            ) : (
              <View style={st.side} />
            )}
          </>
        }
      />
      <View style={st.flex}>
        <FlatList
          indicatorStyle="white"
          ref={list}
          testID="chat-list"
          data={view.messages}
          keyExtractor={(m, i) => m.id || String(i)}
          renderItem={({ item }) => (
            <MessageItem
              m={item}
              mine={!item.by?.id || (!!user && item.by.id === user.id)}
              animate={!!seen.current && !seen.current.has(item.id)}
              onMenu={setMenu}
              dw={dw}
            />
          )}
          onContentSizeChange={toEnd}
          // The composer growing or the keyboard opening shrinks the list: keep the newest line in view.
          onLayout={toEnd}
          onScroll={onScroll}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            id ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.inkDim}
                colors={[colors.ink]}
                progressBackgroundColor={colors.surface2}
              />
            ) : undefined
          }
          ListEmptyComponent={
            !loaded ? (
              <View style={st.center}>
                {error ? (
                  <Button label="Try again" onPress={() => load()} testID="chat-retry" />
                ) : (
                  <ActivityIndicator color={colors.inkDim} accessibilityLabel="Reading the conversation" />
                )}
              </View>
            ) : empty ? (
              <Appear fill duration={motion.enter}>
                <View style={st.welcome} testID="new-chat-screen">
                  <View style={st.hello}>
                    <Mark size={36} />
                    <Text style={st.greeting} accessibilityRole="header">
                      {who ? `${greeting()}, ${who}` : greeting()}
                    </Text>
                    <Text style={st.lead}>Ask about your boards, parts, firmware or models.</Text>
                  </View>
                  {suggestions.length ? (
                    <View style={st.chips}>
                      {suggestions.slice(0, 4).map((sg, i) => (
                        <Pressable
                          key={i}
                          testID={`suggestion-${i}`}
                          onPress={() => composer.current?.fill(sg.text)}
                          accessibilityRole="button"
                          accessibilityLabel={sg.text}
                          style={({ pressed }) => [st.chip, pressed && st.chipPressed]}
                        >
                          {sg.area ? <Text style={st.chipArea}>{sg.area}</Text> : null}
                          <Text style={st.chipText} numberOfLines={3}>
                            {sg.text}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Appear>
            ) : null
          }
          ListFooterComponent={
            <>
              {pending ? <PendingItem text={pending} /> : null}
              {view.writing ? (
                <Appear fill={false} duration={motion.fade}>
                  <WritingItem w={view.writing} dw={dw} />
                </Appear>
              ) : null}
            </>
          }
          contentContainerStyle={[st.listPad, wide && st.column]}
        />
        {away && view.messages.length ? (
          <Pressable
            testID="jump-to-latest"
            accessibilityRole="button"
            accessibilityLabel="Jump to the latest message"
            onPress={() => followEnd(true)}
            hitSlop={8}
            style={({ pressed }) => [st.jump, pressed && st.jumpPressed]}
          >
            <Glyph icon={ArrowDown} size={18} />
          </Pressable>
        ) : null}
        {toast ? (
          <Appear fill={false} from="below" duration={motion.fade} style={st.toastWrap}>
            <Text style={st.toast} accessibilityLiveRegion="polite">
              {toast}
            </Text>
          </Appear>
        ) : null}
      </View>
      {error || notice ? (
        <View style={st.msg}>{error ? <ErrorText>{error}</ErrorText> : <Text style={st.notice}>{notice}</Text>}</View>
      ) : null}
      <View style={wide ? st.column : undefined}>
        <Composer
          ref={composer}
          client={client}
          lang={lang}
          mode={voiceMode}
          writing={!!view.writing}
          onSend={send}
          onStop={stop}
          onVoiceNote={() => setVoiceNote(true)}
        />
      </View>
      <KeyboardSpacer />
      {models ? (
        <ModelSheet
          client={client}
          provider={model.provider}
          model={model.model}
          onClose={() => setModels(false)}
          onPick={pickModel}
        />
      ) : null}
      {voiceNote ? (
        <VoiceNoteSheet
          client={client}
          lang={lang}
          mode={voiceMode}
          onClose={() => setVoiceNote(false)}
          onSend={send}
        />
      ) : null}
      {menu ? (
        <Sheet onClose={() => setMenu(null)} testID="message-menu">
          <ActionList
            actions={[
              {
                id: 'copy',
                label: 'Copy',
                icon: Copy,
                onPress: () => {
                  const text = menu.content;
                  setMenu(null);
                  copy(text).then((ok) => setToast(ok ? 'Copied' : 'Could not copy'));
                },
              },
              {
                id: 'select',
                label: 'Select text',
                icon: TextSelect,
                onPress: () => {
                  setReading(menu.content);
                  setMenu(null);
                },
              },
            ]}
          />
        </Sheet>
      ) : null}
      {reading !== null ? <SelectText text={reading} onClose={() => setReading(null)} /> : null}
    </SafeAreaView>
  );
}

/** A line as plain text to select a part of it. */
function SelectText({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <SafeAreaView style={st.safe}>
        <Appear from="below" duration={motion.sheet}>
          <View style={st.selHead}>
            <Text style={st.selTitle}>Select text</Text>
            <Button label="Done" variant="quiet" onPress={onClose} testID="select-done" />
          </View>
          <ScrollView contentContainerStyle={st.selBody} indicatorStyle="white">
            <Text style={st.selText} selectable>
              {text}
            </Text>
          </ScrollView>
        </Appear>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  // On a wide screen the lines and the composer keep a reading width, in the middle.
  column: { width: '100%', maxWidth: 780, alignSelf: 'center' },
  side: { width: touch, height: touch },
  // The model, small, under the chat's name: the whole of the bar's second line.
  pill: {
    maxWidth: '100%',
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    borderRadius: radius.round,
  },
  pillPressed: { backgroundColor: colors.hover },
  pillText: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  listPad: { paddingTop: space.xs, paddingBottom: space.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xxl },
  welcome: { flex: 1, justifyContent: 'space-between', paddingHorizontal: gutter, paddingBottom: space.sm },
  hello: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: space.xxl },
  greeting: { fontFamily: fonts.sansSemi, fontSize: type.display, color: colors.inkBright, textAlign: 'center' },
  lead: { fontFamily: fonts.sans, fontSize: type.small + 1, lineHeight: 21, color: colors.inkDim, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 72,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipPressed: { backgroundColor: colors.surface2 },
  chipArea: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.inkDim },
  chipText: { fontFamily: fonts.sans, fontSize: type.small + 1, lineHeight: 19, color: colors.ink },
  msg: { paddingHorizontal: gutter, paddingVertical: space.xs },
  notice: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 19, color: colors.inkDim },
  jump: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: space.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  jumpPressed: { backgroundColor: colors.pressed },
  toastWrap: { position: 'absolute', alignSelf: 'center', bottom: space.md },
  toast: {
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface2,
    fontFamily: fonts.sansMedium,
    fontSize: type.small,
    color: colors.ink,
  },
  selHead: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: gutter,
    paddingRight: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  selTitle: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  selBody: { padding: gutter },
  selText: { fontFamily: fonts.sans, fontSize: type.body, lineHeight: type.bodyLine, color: colors.ink },
});
