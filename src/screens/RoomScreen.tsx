/**
 * One room's thread: 3D Drawing, PCB Design or Firmware, the agent that works
 * in it, and where to say the next thing. A room is not a conversation - it
 * is the workspace's own thread, answered by the agent that draws, routes and
 * flashes - so it is drawn with the chat's own lines and read again every
 * couple of seconds while it is open, since the server has no stream for one.
 *
 * What was read here is remembered per room, which is what lets the drawer
 * say how much of a room the agent has written since.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type VoiceLang, type WorkbenchClient } from '../api/client';
import type { RoomId, RoomLine, User } from '../api/types';
import { Appear } from '../components/Appear';
import { Composer } from '../components/Composer';
import { Menu, X } from '../components/icons';
import { KeyboardSpacer } from '../components/KeyboardSpacer';
import { MessageItem } from '../components/MessageItem';
import { ErrorText, Glyph, IconButton } from '../components/ui';
import { asChatMessage, ROOM_ICON, ROOM_LABEL } from '../lib/rooms';
import * as prefs from '../storage/prefs';
import { colors, fonts, gutter, motion, space, touch, type } from '../theme/tokens';

/** How often a room's thread is read again while it is open. */
const EVERY = 2000;

export function RoomScreen({
  room,
  client,
  server,
  user,
  lang,
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
  /** The drawer is a column beside it: no button for it. */
  wide?: boolean;
  onMenu?: () => void;
  /** Back to the conversation. */
  onClose?: () => void;
  /** What was read in the room changed (the drawer's badge). */
  onSeen?: () => void;
}) {
  const [lines, setLines] = useState<RoomLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  // The newest agent line marked as read here, so it is written once per line and not per poll.
  const marked = useRef<string | null>(null);
  const Icon = ROOM_ICON[room];

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const load = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.roomHistory(room).then(
      (got) => {
        if (!mounted.current) return;
        setLines((now) => (sameLines(now, got) ? now : got));
        setError(null);
      },
      (e) => {
        if (mounted.current) setError(e instanceof ApiError ? e.message : 'The room could not be read.');
      },
    );
  }, [client, room]);

  useEffect(() => {
    load();
  }, [load]);

  // The rooms have no stream: read it again while it is open.
  useEffect(() => {
    const t = setInterval(() => load(), EVERY);
    return () => clearInterval(t);
  }, [load]);

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
    setError(null);
    setNotice(null);
    try {
      await client.sayRoom(room, text);
      setNotice('Sent. The agent that works in this room answers here.');
      await load();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The line could not be sent.');
      return false;
    }
  };

  const last = lines?.[lines.length - 1];
  const waiting = !!last && last.role === 'user' && !last.seen_at && !!user && last.by?.id === user.id;

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']} testID={`room-screen-${room}`}>
      <View style={st.head}>
        {!wide && onMenu ? (
          <IconButton icon={Menu} label="Open the conversations" onPress={onMenu} testID="room-open-drawer" />
        ) : (
          <View style={st.side} />
        )}
        <View style={st.mid}>
          <Glyph icon={Icon} size={18} color={colors.inkDim} />
          <Text style={st.title} numberOfLines={1} accessibilityRole="header">
            {ROOM_LABEL[room]}
          </Text>
        </View>
        <IconButton icon={X} label="Close the room" onPress={() => onClose?.()} testID="room-close" />
      </View>
      <View style={st.flex}>
        {lines === null && !error ? (
          <View style={st.center}>
            <ActivityIndicator color={colors.inkDim} accessibilityLabel="Reading the room" />
          </View>
        ) : (
          <FlatList
            indicatorStyle="white"
            testID="room-list"
            data={lines ?? []}
            keyExtractor={(l, i) => l.id || String(i)}
            renderItem={({ item }) => (
              <MessageItem m={asChatMessage(item)} mine={!!user && item.by?.id === user.id} />
            )}
            ListEmptyComponent={
              error ? null : (
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
            }
            ListHeaderComponent={
              <View style={st.intro}>
                <Text style={st.introText}>
                  {ROOM_LABEL[room]} - the workspace keeps its own thread here, apart from your conversations.
                </Text>
              </View>
            }
            contentContainerStyle={[st.pad, wide && st.column]}
          />
        )}
      </View>
      {error || notice || waiting ? (
        <View style={st.msg}>
          {error ? (
            <ErrorText>{error}</ErrorText>
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
          writing={false}
          onSend={send}
          onStop={() => undefined}
        />
      </View>
      <KeyboardSpacer />
    </SafeAreaView>
  );
}

/** The same thread as it was: polling every two seconds should not redraw it. */
function sameLines(now: RoomLine[] | null, got: RoomLine[]): boolean {
  if (!now || now.length !== got.length) return false;
  return now.every((l, i) => l.id === got[i].id && l.text === got[i].text && l.seen_at === got[i].seen_at);
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  head: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  side: { width: touch, height: touch },
  mid: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  column: { width: '100%', maxWidth: 780, alignSelf: 'center' },
  pad: { paddingTop: space.xs, paddingBottom: space.md, flexGrow: 1 },
  intro: { paddingHorizontal: gutter, paddingTop: space.xs, paddingBottom: space.sm },
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
