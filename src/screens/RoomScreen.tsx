/**
 * One room's thread: 3D Drawing, PCB Design or Firmware, the agent that works
 * in it, and where to say the next thing. A room is not a conversation - it
 * is the workspace's own thread, answered by the agent that draws, routes and
 * flashes - so it is drawn with the chat's own lines. It is read again the
 * moment the account's bus says a line was said in it (kind `line`, through
 * S2: live/hub.ts); without the bus, every couple of seconds while it is
 * open, as before (and once a minute as a safety net while the bus is up).
 *
 * What was read here is remembered per room, which is what lets the drawer
 * say how much of a room the agent has written since.
 *
 * It opens at the newest line and is read ten lines at a time: the newest
 * page again every couple of seconds, an older one as the reader nears the
 * top (GET /api/chat?room=&limit=10&before=<id>), with the place kept. At the
 * bottom it stays at the bottom as lines come; read further up, it stays
 * put and "New messages" offers the way down.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type VoiceLang, type WorkbenchClient } from '../api/client';
import type { RoomId, RoomLine, User } from '../api/types';
import { Appear } from '../components/Appear';
import { ChatHeader } from '../components/ChatHeader';
import { Composer } from '../components/Composer';
import { X } from '../components/icons';
import { KeyboardSpacer } from '../components/KeyboardSpacer';
import { MessageItem } from '../components/MessageItem';
import { NewBelow } from '../components/NewBelow';
import { ErrorText, Glyph, IconButton, LoadError } from '../components/ui';
import { orchStrings } from '../lib/orchStrings';
import { layLatest, PAGE, putOlder } from '../lib/paging';
import { asChatMessage, ROOM_ICON, ROOM_LABEL } from '../lib/rooms';
import { bottomReader, followBottom, KEEP_PLACE } from '../lib/stickBottom';
import { useBus, useLive } from '../live/LiveContext';
import * as prefs from '../storage/prefs';
import { colors, fonts, gutter, motion, space, type } from '../theme/tokens';
import { uiLang } from '../update/strings';
import type { VoiceMode } from '../voice/voice';

/** How often a room's thread is read again while it is open and the bus is down. */
const EVERY = 2000;
/** A burst of lines told on the bus is read once, this long after the first. */
const BUS_GATHER_MS = 60;

export function RoomScreen({
  room,
  client,
  server,
  user,
  lang,
  voiceMode = 'record',
  wide = false,
  onMenu,
  onClose,
  onSeen,
}: {
  room: RoomId;
  client: WorkbenchClient | null;
  server: string | null;
  user: User | null;
  /** What dictation here is transcribed as. */
  lang: VoiceLang;
  /** When dictated words appear: while speaking or after recording. */
  voiceMode?: VoiceMode;
  /** The drawer is a column beside it: no button for it. */
  wide?: boolean;
  onMenu?: () => void;
  /** Back to the conversation. */
  onClose?: () => void;
  /** What was read in the room changed (the drawer's badge). */
  onSeen?: () => void;
}) {
  const [lines, setLines] = useState<RoomLine[] | null>(null);
  /** The thread could not be read: what it said, and the way to try again. */
  const [error, setError] = useState<string | null>(null);
  /** A line could not be sent: told beside the box, while the box has it back. */
  const [sendError, setSendError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  // The newest agent line marked as read here, so it is written once per line and not per poll.
  const marked = useRef<string | null>(null);
  const Icon = ROOM_ICON[room];
  /** Older lines are there to read (the start of the thread not reached yet). */
  const [more, setMore] = useState(true);
  const [older, setOlder] = useState(false);
  const [below, setBelow] = useState(false);
  const list = useRef<FlatList<RoomLine>>(null);
  /** Who is reading the bottom of the thread, told by their finger alone (lib/stickBottom.ts). */
  const reader = useMemo(() => bottomReader(), []);
  /** A line arriving, or one being written, while the reader is at the bottom: stay there. */
  const follow = useCallback(() => followBottom(list.current, reader.atBottom), [reader]);
  const linesRef = useRef<RoomLine[] | null>(null);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  const newBelow = orchStrings(uiLang(lang)).newBelow;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const load = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.roomHistory(room, PAGE).then(
      (got) => {
        if (!mounted.current) return;
        const held = linesRef.current;
        const { lines: next, gap } = layLatest(held, got);
        if (held === null || gap) setMore(got.length >= PAGE);
        // Something new at the end while the reader is further up: offered, not forced.
        const newest = next[next.length - 1]?.id;
        if (held?.length && newest && newest !== held[held.length - 1]?.id && !reader.atBottom()) setBelow(true);
        setLines((now) => (sameLines(now, next) ? now : next));
        setError(null);
      },
      (e) => {
        if (mounted.current) setError(e instanceof ApiError ? e.message : 'The room could not be read.');
      },
    );
  }, [client, room, reader]);

  useEffect(() => {
    load();
  }, [load]);

  /** The page before the oldest line held, as the reader nears the top. */
  const loadOlder = useCallback(() => {
    const held = linesRef.current;
    if (!client || !more || older || !held?.length) return;
    setOlder(true);
    client.roomHistory(room, PAGE, held[0].id).then(
      (got) => {
        if (!mounted.current) return;
        const now = linesRef.current ?? [];
        const { lines: next, added } = putOlder(now, got);
        // A short page, or nothing new (a server that does not page back): the start is reached.
        if (got.length < PAGE || !added) setMore(false);
        if (added) setLines(next);
        setOlder(false);
      },
      () => mounted.current && setOlder(false),
    );
  }, [client, room, more, older]);

  // The list is drawn upside down (newest at the bottom, where it opens): offset 0 is the bottom.
  /** The list moving itself - keeping a reader's place as lines arrive - scrolls too,
   *  and is not the reader: only a finger says where they are (lib/stickBottom.ts). */
  const scrolled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    reader.scroll(e.nativeEvent.contentOffset.y);
    if (reader.atBottom() && below) setBelow(false);
  };
  const toBottom = () => {
    setBelow(false);
    reader.toBottom();
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Read again as the bus tells of a line here (or of any room: `room` null), and
  // when it opens again; without it, on the old timer.
  const hub = useLive();
  const pace = useMemo(() => hub?.pace() ?? null, [hub]);
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (soon.current) clearTimeout(soon.current);
    },
    [],
  );
  useBus(['line'], (e) => {
    if (e.k === '$down') return;
    const of = (e.p as { room?: string | null } | undefined)?.room;
    if (e.k === 'line' && of && of !== room) return;
    pace?.mark();
    if (soon.current) return;
    soon.current = setTimeout(() => {
      soon.current = null;
      load();
    }, BUS_GATHER_MS);
  });

  useEffect(() => {
    const t = setInterval(() => {
      if (!pace || pace.due()) load();
    }, EVERY);
    return () => clearInterval(t);
  }, [load, pace]);

  // What is on screen is read: the agent's newest line, remembered for the badge.
  useEffect(() => {
    if (!server || !lines?.length) return;
    const newest = [...lines].reverse().find((l) => l.role === 'agent')?.at;
    if (!newest || newest === marked.current) return;
    marked.current = newest;
    prefs.setRoomSeen(server, room, newest).then(() => onSeen?.());
  }, [lines, server, room, onSeen]);

  const send = async (text: string): Promise<boolean> => {
    if (!client) return false;
    setSendError(null);
    setNotice(null);
    try {
      await client.sayRoom(room, text);
      setNotice('Sent. The agent that works in this room answers here.');
      // One's own line: the way down to it, wherever one was reading.
      toBottom();
      await load();
      return true;
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : 'The line could not be sent.');
      return false;
    }
  };

  const last = lines?.[lines.length - 1];
  const waiting = !!last && last.role === 'user' && !last.seen_at && !!user && last.by?.id === user.id;

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']} testID={`room-screen-${room}`}>
      <ChatHeader
        title={ROOM_LABEL[room]}
        icon={<Glyph icon={Icon} size={17} color={colors.inkDim} />}
        lang={lang}
        client={client}
        wide={wide}
        onMenu={onMenu}
        menuTestID="room-open-drawer"
        titleTestID="room-title"
        right={<IconButton icon={X} label="Close the room" onPress={() => onClose?.()} testID="room-close" />}
      />
      <View style={st.flex}>
        {lines === null && !error ? (
          <View style={st.center}>
            <ActivityIndicator color={colors.inkDim} accessibilityLabel="Reading the room" />
          </View>
        ) : !lines?.length ? (
          error ? (
            <LoadError text={error} onRetry={load} centered />
          ) : (
            <Appear fill duration={motion.enter}>
              <View style={st.empty}>
                <Text style={st.emptyTitle}>Nothing in this room yet</Text>
                <Text style={st.emptyLead}>
                  Say what is to be done in it - the agent working on the drawings, the board or the firmware
                  reads this room and answers here.
                </Text>
              </View>
            </Appear>
          )
        ) : (
          <FlatList
            ref={list}
            inverted
            indicatorStyle="white"
            testID="room-list"
            data={[...lines].reverse()}
            keyExtractor={(l, i) => l.id || String(i)}
            renderItem={({ item }) => (
              <MessageItem m={asChatMessage(item)} mine={!!user && item.by?.id === user.id} />
            )}
            onScroll={scrolled}
            onScrollBeginDrag={reader.begin}
            onScrollEndDrag={reader.end}
            onMomentumScrollBegin={reader.begin}
            onMomentumScrollEnd={reader.end}
            onContentSizeChange={follow}
            scrollEventThrottle={64}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            maintainVisibleContentPosition={KEEP_PLACE}
            // Upside down, the footer is the top: the older page coming in, or where the thread starts.
            ListFooterComponent={
              older ? (
                <ActivityIndicator style={st.older} color={colors.inkDim} accessibilityLabel="Reading older lines" testID="room-older" />
              ) : more ? null : (
                <View style={st.intro}>
                  <Text style={st.introText}>
                    {ROOM_LABEL[room]} - the workspace keeps its own thread here, apart from your conversations.
                  </Text>
                </View>
              )
            }
            contentContainerStyle={[st.pad, wide && st.column]}
          />
        )}
        {below ? <NewBelow label={newBelow} onPress={toBottom} /> : null}
      </View>
      {error || sendError || notice || waiting ? (
        <View style={st.msg}>
          {error ? (
            <LoadError text={error} onRetry={load} />
          ) : sendError ? (
            <ErrorText>{sendError}</ErrorText>
          ) : waiting ? (
            <Text style={st.note}>The agent has not read this yet.</Text>
          ) : (
            <Text style={st.note}>{notice}</Text>
          )}
        </View>
      ) : null}
      <View style={wide ? st.column : undefined}>
        <Composer
          client={client}
          lang={lang}
          mode={voiceMode}
          writing={false}
          onSend={send}
          onStop={() => undefined}
          draftKey={`room:${room}`}
        />
      </View>
      <KeyboardSpacer />
    </SafeAreaView>
  );
}

/** The same thread as it was: reading it again should not redraw it. */
function sameLines(now: RoomLine[] | null, got: RoomLine[]): boolean {
  if (!now || now.length !== got.length) return false;
  return now.every((l, i) => l.id === got[i].id && l.text === got[i].text && l.seen_at === got[i].seen_at);
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: 780, alignSelf: 'center' },
  // Upside down, the top is the bottom: the air under the newest line, before the composer.
  pad: { paddingTop: space.xl, paddingBottom: space.md, flexGrow: 1 },
  intro: { paddingHorizontal: gutter, paddingTop: space.xs, paddingBottom: space.sm },
  older: { paddingVertical: space.md },
  introText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xxl },
  empty: { paddingHorizontal: gutter, paddingVertical: space.xxl, gap: 8, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright, textAlign: 'center' },
  emptyLead: {
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: 21,
    color: colors.inkDim,
    textAlign: 'center',
  },
  msg: { paddingHorizontal: gutter, paddingVertical: space.xs },
  note: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 19, color: colors.inkDim },
});
