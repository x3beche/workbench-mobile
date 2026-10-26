/**
 * One of one's own Claude Code sessions (backend/wbclaude.py), as the web
 * app's Chat opens it (frontend/src/app/rooms/claude-sessions.ts): the
 * prompts and Claude's answers the Claude pool recorded, and - where the
 * session runs under wb-claude on its computer with remote input on - a box
 * whose lines are typed into that terminal when Claude is back at its prompt.
 *
 * - It opens at the newest turn and is read ten turns at a time, as a room:
 *   an older page comes in as the reader nears the top (GET
 *   /api/wbc/sessions/{sid}/turns?limit=10&before=), with the place kept.
 * - A line sent from here shows with what became of it ("queued - Claude is
 *   working", "delivered", "not delivered") until the conversation has it,
 *   marked "from Workbench" there. Up to four pictures go with it, from the
 *   phone's photos or camera.
 * - Claude Code's suggestion of what to type next (the newest page's
 *   `suggestion`) is the empty box's words, dim and italic, with a Use chip
 *   that puts it in the box (Tab in the terminal); typing or sending puts it away.
 * - Without a way to write (not one's own, no wb-claude, remote off) the box
 *   is a note saying why, in the server's terms.
 * - The account's bus says when something changed (kind `wbc`, {sid, what}):
 *   the session is read again (its turns too when the bridge changed state).
 *   While it is active it is also read every few seconds, as a slow safety
 *   net while the bus is up; nothing is read while the app is in the background.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type VoiceLang, type WorkbenchClient } from '../api/client';
import type { User, WbcDetail, WbcMessage, WbcSession, WbcTurn } from '../api/types';
import { Appear } from '../components/Appear';
import { Composer } from '../components/Composer';
import { Camera, Images, Menu, Paperclip, SquareTerminal, X } from '../components/icons';
import { KeyboardSpacer } from '../components/KeyboardSpacer';
import { Markdown } from '../components/Markdown';
import { modelName } from '../components/MessageItem';
import { NewBelow } from '../components/NewBelow';
import { ActionList, Sheet } from '../components/Sheet';
import { StateDot } from '../components/StateDot';
import { ErrorText, Glyph, IconButton, wrapAnywhere } from '../components/ui';
import { PictureViewer, WbcThumb } from '../components/WbcPicture';
import { AT_BOTTOM, followBottom } from '../lib/stickBottom';
import { clock } from '../lib/time';
import {
  admit,
  IMAGE_RULES,
  isoOf,
  layTurns,
  liveDot,
  MARK,
  pendingOf,
  pictureType,
  putOlderTurns,
  serverWords,
  stateWord,
  statusTone,
  statusWord,
  TURNS_PAGE,
  turnKey,
  unmark,
  whyText,
  type Picked,
} from '../lib/wbc';
import type { WbcStrings } from '../lib/wbcStrings';
import { inFront } from '../live/hub';
import { useBus, useLive } from '../live/LiveContext';
import { colors, fonts, gutter, motion, radius, space, touch, type } from '../theme/tokens';
import type { VoiceMode } from '../voice/voice';

/** While a session is active (or wb-claude holds it), it is read this often: the gateway tells nobody of a new turn. */
const EVERY = 5000;
/** Its safety net while the bus is up. */
const SAFETY = 30_000;
/** A burst of bus events is read once, this long after the first. */
const GATHER_MS = 120;

type Item = { kind: 'turn'; turn: WbcTurn; same: boolean } | { kind: 'msg'; m: WbcMessage };

export function ClaudeSessionScreen({
  sid,
  client,
  user,
  initial = null,
  t,
  lang,
  voiceMode = 'record',
  wide = false,
  onMenu,
  onClose,
  onChanged,
}: {
  sid: string;
  client: WorkbenchClient | null;
  user: User | null;
  /** What the drawer's list knows of it, until it is read. */
  initial?: WbcSession | null;
  t: WbcStrings;
  lang: VoiceLang;
  voiceMode?: VoiceMode;
  wide?: boolean;
  onMenu?: () => void;
  onClose?: () => void;
  /** Its state changed (the drawer's row). */
  onChanged?: () => void;
}) {
  const [s, setS] = useState<WbcDetail | null>(() => (initial ? { ...initial, messages: [], mark: MARK } : null));
  const [turns, setTurns] = useState<WbcTurn[] | null>(null);
  const [more, setMore] = useState(false);
  const [older, setOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [below, setBelow] = useState(false);
  const [pics, setPics] = useState<Picked[]>([]);
  const [picError, setPicError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const before = useRef<number | null>(null);
  /** Claude Code's suggestion of what to type next, offered in the empty box. */
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const turnsRef = useRef<WbcTurn[] | null>(null);
  const atBottom = useRef(true);
  const list = useRef<FlatList<Item>>(null);
  /** A turn arriving, or one being written, while the reader is at the bottom: stay there. */
  const follow = useCallback(() => followBottom(list.current, () => atBottom.current), []);
  const mounted = useRef(true);
  const seq = useRef(0);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const fail = useCallback(
    (e: unknown, what: string) => {
      if (!(e instanceof ApiError)) return what;
      if (e.status === 0) return t.cantReach;
      if (e.status === 429) return t.tooMany;
      return serverWords(e.message, t);
    },
    [t],
  );

  /** The newest page, kept under the older pages already read. */
  const latest = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.wbcTurns(sid, TURNS_PAGE).then(
      (page) => {
        if (!mounted.current) return;
        const held = turnsRef.current;
        const { turns: next, gap } = layTurns(held, page);
        if (held === null || gap) {
          setMore(page.more);
          before.current = page.before;
        }
        const newest = next[next.length - 1];
        const was = held?.[held.length - 1];
        if (held?.length && newest && (!was || turnKey(newest) !== turnKey(was)) && !atBottom.current) setBelow(true);
        setTurns((now) => (sameTurns(now, next) ? now : next));
        setSuggestion(page.suggestion || null);
      },
      (e) => {
        if (!mounted.current) return;
        setTurns((now) => now ?? []);
        setError(fail(e, t.cantRead));
      },
    );
  }, [client, sid, fail, t]);

  const refresh = useCallback(
    (withTurns = false): Promise<void> => {
      if (!client) return Promise.resolve();
      const detail = client.wbcSession(sid).then(
        (d) => {
          if (!mounted.current) return;
          setS(d);
          setError(null);
        },
        (e) => mounted.current && setError(fail(e, t.cantRead)),
      );
      return Promise.all([detail, withTurns ? latest() : null]).then(() => undefined);
    },
    [client, sid, latest, fail, t],
  );

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  /** The page before the oldest turn held, as the reader nears the top. */
  const loadOlder = useCallback(() => {
    const held = turnsRef.current;
    if (!client || !more || older || !held?.length || !before.current) return;
    setOlder(true);
    client.wbcTurns(sid, TURNS_PAGE, before.current).then(
      (page) => {
        if (!mounted.current) return;
        const { turns: next, added } = putOlderTurns(turnsRef.current ?? [], page.turns ?? []);
        before.current = page.before;
        setMore(page.more && !!page.before && added > 0);
        if (added) setTurns(next);
        setOlder(false);
      },
      (e) => {
        if (!mounted.current) return;
        setOlder(false);
        setError(fail(e, t.cantRead));
      },
    );
  }, [client, sid, more, older, fail, t]);

  // The bus: something about this session changed. Read it again (its turns too when the bridge changed).
  const hub = useLive();
  const pace = useMemo(() => hub?.pace(SAFETY) ?? null, [hub]);
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnsToo = useRef(false);
  useEffect(
    () => () => {
      if (soon.current) clearTimeout(soon.current);
    },
    [],
  );
  useBus(['wbc'], (e) => {
    if (e.k === '$down') return;
    const p = e.p as { sid?: string; what?: string } | undefined;
    if (e.k === 'wbc' && p?.sid !== sid) return;
    if (e.k === '$open' || p?.what === 'bridge') turnsToo.current = true;
    pace?.mark();
    if (soon.current) return;
    soon.current = setTimeout(() => {
      soon.current = null;
      const both = turnsToo.current;
      turnsToo.current = false;
      refresh(both);
      onChanged?.();
    }, GATHER_MS);
  });

  // An active session's new turns come from the gateway, which tells nobody: read while it runs, in the front only.
  const live = !!s && (s.status === 'active' || !!s.bridge?.connected);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (!inFront()) return;
      if (!pace || pace.due()) refresh(true);
    }, EVERY);
    return () => clearInterval(timer);
  }, [live, pace, refresh]);

  // Upside down (newest at the bottom, where it opens): offset 0 is the bottom.
  const scrolled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = e.nativeEvent.contentOffset.y < AT_BOTTOM;
    atBottom.current = at;
    if (at && below) setBelow(false);
  };
  const toBottom = () => {
    setBelow(false);
    atBottom.current = true;
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // ---- sending -------------------------------------------------------------------

  const rules = s?.images ?? IMAGE_RULES;
  const takesPics = !!s?.bridge?.images;

  const add = (got: Picked[]) => {
    const r = admit(pics, got, t, rules);
    setPics(r.pics);
    setPicError(r.error);
  };

  const pick = async (camera: boolean) => {
    setPicking(false);
    setPicError(null);
    if (camera) {
      const ok = await ImagePicker.requestCameraPermissionsAsync();
      if (!ok.granted) {
        setPicError(t.noCamera);
        return;
      }
    }
    const left = Math.max(1, rules.max - pics.length);
    // A photo from the camera is made smaller (a phone's is often over 5 MB); one picked is sent as it is.
    const got = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsMultipleSelection: true,
          selectionLimit: left,
        });
    if (got.canceled) return;
    add(
      got.assets.map((a, i) => {
        const guess = pictureType(a.mimeType, a.fileName || '');
        const ext = (guess.split('/')[1] || 'jpeg').replace('jpeg', 'jpg');
        const name = a.fileName || `picture-${Date.now()}-${i + 1}.${ext}`;
        const kind = pictureType(a.mimeType, name);
        return {
          key: `p${++seq.current}`,
          part: a.file ? { blob: a.file, name } : { uri: a.uri, name, type: kind },
          uri: a.uri,
          type: kind,
          size: a.fileSize ?? a.file?.size,
        };
      }),
    );
  };

  const attach = () => {
    if (!takesPics) {
      setPicError(t.updateForPictures);
      return;
    }
    if (pics.length >= rules.max) {
      setPicError(t.atMost(rules.max));
      return;
    }
    // The web build has no camera of its own to ask: straight to the files.
    if (Platform.OS === 'web') pick(false);
    else setPicking(true);
  };

  const send = async (text: string): Promise<boolean> => {
    if (!client || !s?.may_send) return false;
    const with_ = pics;
    if (!text && !with_.length) return false;
    setSuggestion(null);
    setError(null);
    setNotice(null);
    setPicError(null);
    try {
      const m = await client.wbcSend(
        sid,
        text,
        with_.map((p) => p.part),
      );
      if (!mounted.current) return true;
      setPics([]);
      setS((now) => (now ? { ...now, messages: [...now.messages.filter((x) => x.id !== m.id), m] } : now));
      toBottom();
      refresh();
      return true;
    } catch (e) {
      if (mounted.current) {
        setError(fail(e, t.notDelivered));
        refresh();
      }
      return false;
    }
  };

  // ---- drawing ---------------------------------------------------------------------

  const mark = s?.mark || MARK;
  const pending = useMemo(() => pendingOf(s?.messages ?? [], turns ?? [], mark), [s?.messages, turns, mark]);
  const items = useMemo<Item[]>(() => {
    const ts = turns ?? [];
    const rows: Item[] = ts.map((turn, i) => ({ kind: 'turn', turn, same: i > 0 && ts[i - 1].role === turn.role }));
    for (const m of pending) rows.push({ kind: 'msg', m });
    return rows.reverse();
  }, [turns, pending]);
  const mine = !!s && (s.mine || (!!user && s.owner.id === user.id));
  const person = mine ? null : s?.owner.name || null;
  const dot = liveDot(s?.bridge);
  const sub = [t.claudeCode, s?.computer, s?.bridge?.connected ? s.bridge.cwd : ''].filter(Boolean).join(' · ');

  const renderItem = ({ item }: { item: Item }) =>
    item.kind === 'turn' ? (
      <TurnRow
        turn={item.turn}
        same={item.same}
        sid={sid}
        client={client}
        mark={mark}
        person={person}
        t={t}
        onZoom={setZoom}
      />
    ) : (
      <PendingRow m={item.m} sid={sid} client={client} t={t} onZoom={setZoom} />
    );

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']} testID="wbc-screen">
      <View style={st.head}>
        {!wide && onMenu ? (
          <IconButton icon={Menu} label={t.menu} onPress={onMenu} testID="wbc-open-drawer" />
        ) : (
          <View style={st.side} />
        )}
        <View style={st.mid}>
          <Text style={st.title} numberOfLines={1} accessibilityRole="header" testID="wbc-title">
            {s?.name || sid.slice(0, 8)}
          </Text>
          <View style={st.subRow}>
            {dot ? <StateDot s={dot} /> : null}
            {/* One line: what Claude does now in ink, then where, cut at the end. */}
            <Text style={st.sub} numberOfLines={1} testID="wbc-state">
              {s ? <Text style={st.state}>{stateWord(s, t)}</Text> : null}
              {s ? ` · ${sub}` : sub}
            </Text>
          </View>
        </View>
        <IconButton icon={X} label={t.back} onPress={() => onClose?.()} testID="wbc-close" />
      </View>
      {s?.bridge?.connected && (!s.bridge.remote || s.bridge.outdated) ? (
        <View style={st.tags}>
          {!s.bridge.remote ? <Text style={st.tag}>{t.remoteOff}</Text> : null}
          {s.bridge.outdated ? (
            <Pressable
              onPress={() => setNotice(t.updateWbcLong)}
              accessibilityRole="button"
              accessibilityHint={t.updateWbcLong}
              testID="wbc-outdated"
            >
              <Text style={st.tag}>{t.updateWbc}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={st.flex}>
        {turns === null && !error ? (
          <View style={st.center}>
            <ActivityIndicator color={colors.inkDim} accessibilityLabel={t.reading} />
          </View>
        ) : !items.length ? (
          error ? null : (
            <Appear fill duration={motion.enter}>
              <View style={st.empty} testID="wbc-empty">
                <Glyph icon={SquareTerminal} size={28} color={colors.inkDim} />
                <Text style={st.emptyTitle}>{s?.name || t.session}</Text>
                <Text style={st.emptyLead}>{t.nothingYet}</Text>
              </View>
            </Appear>
          )
        ) : (
          <FlatList
            ref={list}
            inverted
            indicatorStyle="white"
            testID="wbc-list"
            data={items}
            keyExtractor={(it) => (it.kind === 'turn' ? `t:${turnKey(it.turn)}` : `m:${it.m.id}`)}
            renderItem={renderItem}
            onScroll={scrolled}
            onContentSizeChange={follow}
            scrollEventThrottle={64}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            ListFooterComponent={
              older ? (
                <ActivityIndicator
                  style={st.older}
                  color={colors.inkDim}
                  accessibilityLabel={t.readingOlder}
                  testID="wbc-older"
                />
              ) : null
            }
            contentContainerStyle={[st.pad, wide && st.column]}
          />
        )}
        {below ? <NewBelow label={t.newBelow} onPress={toBottom} /> : null}
      </View>
      {error || notice ? (
        <View style={[st.msg, wide && st.column]}>
          {error ? <ErrorText>{error}</ErrorText> : <Text style={st.note}>{notice}</Text>}
        </View>
      ) : null}
      {s ? (
        s.may_send ? (
          <View style={wide ? st.column : undefined} testID="wbc-composer">
            <Composer
              client={client}
              lang={lang}
              mode={voiceMode}
              writing={false}
              placeholder={t.placeholder}
              suggestion={suggestion ? { text: suggestion, use: t.useSuggestion } : null}
              ready={pics.length > 0}
              onSend={send}
              onStop={() => undefined}
              above={
                pics.length || picError ? (
                  <View style={st.picked}>
                    {pics.map((p, i) => (
                      <View key={p.key} style={st.chip}>
                        <Image source={{ uri: p.uri }} style={st.chipImg} accessibilityLabel={t.picture(i + 1)} />
                        <Pressable
                          onPress={() => {
                            setPics((now) => now.filter((x) => x.key !== p.key));
                            setPicError(null);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.remove}: ${t.picture(i + 1)}`}
                          hitSlop={8}
                          style={st.chipX}
                          testID={`wbc-unpick-${i}`}
                        >
                          <Glyph icon={X} size={12} color={colors.ink} />
                        </Pressable>
                      </View>
                    ))}
                    {picError ? (
                      <Text style={st.picError} accessibilityRole="alert" testID="wbc-pic-error">
                        {picError}
                      </Text>
                    ) : null}
                  </View>
                ) : null
              }
              tool={
                <IconButton
                  icon={Paperclip}
                  label={takesPics ? t.attach : t.updateForPictures}
                  onPress={attach}
                  testID="wbc-attach"
                  size={20}
                  color={takesPics ? colors.inkDim : colors.pressed}
                  style={st.clip}
                />
              }
            />
          </View>
        ) : (
          <View style={[st.why, wide && st.column]} accessibilityRole="text" testID="wbc-why">
            <Text style={st.whyText}>{whyText(s, t)}</Text>
          </View>
        )
      ) : null}
      <KeyboardSpacer />
      {picking ? (
        <Sheet onClose={() => setPicking(false)} title={t.attach} testID="wbc-pick">
          <ActionList
            actions={[
              { id: 'wbc-photos', label: t.fromPhotos, icon: Images, onPress: () => pick(false) },
              { id: 'wbc-camera', label: t.fromCamera, icon: Camera, onPress: () => pick(true) },
            ]}
          />
        </Sheet>
      ) : null}
      {zoom ? (
        <PictureViewer uri={zoom} label={t.showWhole} closeLabel={t.close} onClose={() => setZoom(null)} />
      ) : null}
    </SafeAreaView>
  );
}

/** The same turns as they were: reading them again should not redraw them. */
function sameTurns(now: WbcTurn[] | null, got: WbcTurn[]): boolean {
  if (!now || now.length !== got.length) return false;
  return now.every((x, i) => turnKey(x) === turnKey(got[i]) && x.text === got[i].text);
}

function Pics({
  paths,
  client,
  small,
  t,
  onZoom,
  right,
  note,
}: {
  paths: string[];
  client: WorkbenchClient | null;
  small?: boolean;
  t: WbcStrings;
  onZoom: (uri: string) => void;
  right?: boolean;
  note?: string;
}) {
  return (
    <View style={[st.pics, right && st.picsRight]}>
      {note ? <Text style={[st.picsNote, right && st.right]}>{note}</Text> : null}
      <View style={[st.picsRow, right && st.picsRight]}>
        {paths.map((p, k) => (
          <WbcThumb
            key={p}
            client={client}
            path={p}
            small={small}
            label={`${t.picture(k + 1)}. ${t.showWhole}`}
            goneText={t.picturesGone}
            onOpen={onZoom}
            testID="wbc-pic"
          />
        ))}
      </View>
    </View>
  );
}

function TurnRow({
  turn,
  same,
  sid,
  client,
  mark,
  person,
  t,
  onZoom,
}: {
  turn: WbcTurn;
  same: boolean;
  sid: string;
  client: WorkbenchClient | null;
  mark: string;
  /** Whose prompts these are, when not one's own (the owner and the admins read). */
  person: string | null;
  t: WbcStrings;
  onZoom: (uri: string) => void;
}) {
  const paths = (turn.images ?? []).map((p) => client?.wbcTurnImagePath(sid, p.req, p.n) ?? '');
  const at = clock(isoOf(turn.at));
  if (turn.role === 'user') {
    const words = unmark(turn.text, mark);
    return (
      <View style={[st.msgRow, st.user]} testID="wbc-turn-user">
        {turn.remote || person ? (
          <View style={st.userHead}>
            {person ? <Text style={st.headText}>{person}</Text> : null}
            {turn.remote ? (
              <Text style={st.tag} testID="wbc-remote">
                {t.fromWorkbench}
              </Text>
            ) : null}
            <Text style={st.headText}>{at}</Text>
          </View>
        ) : null}
        {words ? (
          <View style={st.bubble}>
            <Text style={[st.userText, wrapAnywhere]} selectable>
              {words}
            </Text>
          </View>
        ) : null}
        {paths.length ? <Pics paths={paths} client={client} t={t} onZoom={onZoom} right /> : null}
      </View>
    );
  }
  return (
    <View style={[st.msgRow, same && st.sameRow]} testID="wbc-turn-answer">
      {!same ? (
        <Text style={st.headText} numberOfLines={1}>
          <Text style={st.headName}>{t.claude}</Text>
          {turn.model ? ` · ${modelName(turn.model)}` : ''}
          {at ? `  ${at}` : ''}
        </Text>
      ) : null}
      <Markdown text={turn.text} />
      {turn.cut ? <Text style={st.headText}>{t.cut}</Text> : null}
      {paths.length ? <Pics paths={paths} client={client} small t={t} onZoom={onZoom} note={t.readByTool} /> : null}
    </View>
  );
}

function PendingRow({
  m,
  sid,
  client,
  t,
  onZoom,
}: {
  m: WbcMessage;
  sid: string;
  client: WorkbenchClient | null;
  t: WbcStrings;
  onZoom: (uri: string) => void;
}) {
  const tone = statusTone(m);
  const paths = (m.images ?? []).map((im) => client?.wbcMessageImagePath(sid, m.id, im.n) ?? '');
  return (
    <Appear fill={false} from="below" duration={motion.fade}>
      <View style={[st.msgRow, st.user]} testID={`wbc-pending-${m.id}`}>
        <View style={st.userHead}>
          <Text style={[st.status, tone === 'ok' && st.ok, tone === 'danger' && st.danger]} testID="wbc-status">
            {statusWord(m, t)}
          </Text>
          {m.at ? <Text style={st.headText}>{clock(isoOf(m.at))}</Text> : null}
        </View>
        {m.text ? (
          <View style={[st.bubble, st.pendingBubble]}>
            <Text style={[st.userText, wrapAnywhere]}>{m.text}</Text>
          </View>
        ) : null}
        {m.images?.length ? (
          m.images_gone ? (
            <Text style={st.headText}>{t.picturesGone}</Text>
          ) : (
            <Pics paths={paths} client={client} t={t} onZoom={onZoom} right />
          )
        ) : null}
      </View>
    </Appear>
  );
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
  mid: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: space.xs },
  title: { maxWidth: '100%', fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  subRow: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  state: { fontFamily: fonts.sansMedium, color: colors.ink },
  sub: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  tags: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingVertical: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tag: {
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.hover,
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    color: colors.inkDim,
  },
  column: { width: '100%', maxWidth: 780, alignSelf: 'center' },
  // Upside down, the top is the bottom: the air under the newest line, before the composer.
  pad: { paddingTop: space.xl, paddingBottom: space.md, flexGrow: 1 },
  older: { paddingVertical: space.md },
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
  msgRow: { gap: 8, paddingHorizontal: gutter, paddingVertical: space.md },
  sameRow: { paddingTop: 0 },
  user: { alignItems: 'flex-end', gap: 4, paddingVertical: space.sm },
  userHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  headText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  headName: { fontFamily: fonts.sansMedium, color: colors.inkDim },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.bubble,
    borderBottomRightRadius: 6,
  },
  pendingBubble: { opacity: 0.8 },
  userText: { fontFamily: fonts.sans, fontSize: type.body, lineHeight: type.bodyLine, color: colors.ink },
  status: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, textAlign: 'right' },
  ok: { color: colors.ok },
  danger: { color: colors.danger },
  pics: { gap: 4 },
  picsRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  picsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  picsNote: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  right: { textAlign: 'right' },
  msg: { paddingHorizontal: gutter, paddingVertical: space.xs },
  note: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 19, color: colors.inkDim },
  why: {
    marginHorizontal: space.md,
    marginTop: space.xs,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.field / 2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  whyText: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 19, color: colors.inkDim },
  picked: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: space.xs },
  chip: { width: 56, height: 56 },
  chipImg: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface2 },
  chipX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  picError: { flexBasis: '100%', fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.danger },
  clip: { width: 40, height: 40 },
});
