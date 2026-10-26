/**
 * One of one's own OpenCode sessions (backend/wbopencode.py), as the web
 * app's Chat opens it (frontend/src/app/rooms/opencode-sessions.ts), in this
 * app's own conversation look: the person's lines as bubbles on the right
 * ("from Workbench" on the ones sent from here, with their pictures; "On the
 * computer" when typed there by someone else's view), OpenCode's answer as
 * an answer of the Chat - under the model's name, its thinking in the
 * Chat's folded block, its words in Markdown, its tool calls as the Chat's
 * step rows - and what OpenCode asks as a card answered from here.
 *
 * - It opens at the newest message; older turns come in ten at a time as
 *   the reader nears the top, as a room's lines (the server sends the last
 *   120 messages; "Only the latest messages are shown" above them when it
 *   held more).
 * - Live: the account's S2 stream `wbo` carries every change as it is made
 *   (a text delta with its place in its part); without it the session is
 *   read again every two seconds while OpenCode works or a line waits, every
 *   ten otherwise, never in the background. The bus (kind `wbo`) says when a
 *   line's state or the run changed.
 * - Where the server allows writing, the composer sends words and up to four
 *   pictures from the photos or the camera; a line shows "sent - waiting for
 *   the computer", "delivered" or why not until the conversation has it.
 *   Otherwise a note says why, in the server's terms.
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
import type { User, WboAnswer, WboAsk, WboDetail, WboMsg, WboSend, WboSession } from '../api/types';
import { Appear } from '../components/Appear';
import { AskCard } from '../components/AskCard';
import { Composer } from '../components/Composer';
import { Camera, Images, Menu, Paperclip, SquareCode, X } from '../components/icons';
import { KeyboardSpacer } from '../components/KeyboardSpacer';
import { Markdown } from '../components/Markdown';
import { modelName, Steps, Thinking, TypingDots } from '../components/MessageItem';
import { NewBelow } from '../components/NewBelow';
import { ActionList, Sheet } from '../components/Sheet';
import { StateDot } from '../components/StateDot';
import { ErrorText, Glyph, IconButton, wrapAnywhere } from '../components/ui';
import { PictureViewer, WbcThumb } from '../components/WbcPicture';
import { clock } from '../lib/time';
import { admit, IMAGE_RULES, isoOf, pictureType, serverWords, type Picked } from '../lib/wbc';
import {
  applyWbo,
  buildTurns,
  looseAsks,
  pendingSends,
  putAsk,
  remoteIds,
  sendOf,
  sendTone,
  sendWord,
  TURNS_PAGE,
  wboDot,
  wboWhy,
  wboWord,
  type Turn,
  type WboEvent,
} from '../lib/wbo';
import type { WboStrings } from '../lib/wboStrings';
import { inFront } from '../live/hub';
import { useBus, useLive } from '../live/LiveContext';
import { colors, fonts, gutter, motion, radius, space, touch, type } from '../theme/tokens';
import type { VoiceMode } from '../voice/voice';

/** Without the stream: read this often while OpenCode works or a line waits. */
const BUSY_MS = 2000;
/** Otherwise this often. */
const QUIET_MS = 10_000;
/** A burst of bus events is read once, this long after the first. */
const GATHER_MS = 150;
const AT_BOTTOM = 60;

type Item =
  | { kind: 'turn'; turn: Turn; same: boolean }
  | { kind: 'ask'; a: WboAsk }
  | { kind: 'send'; m: WboSend }
  | { kind: 'cut' };

export function OpencodeSessionScreen({
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
  initial?: WboSession | null;
  t: WboStrings;
  lang: VoiceLang;
  voiceMode?: VoiceMode;
  wide?: boolean;
  onMenu?: () => void;
  onClose?: () => void;
  /** Its state changed (the drawer's row). */
  onChanged?: () => void;
}) {
  // The session and its messages change together (a live record touches both): one state.
  const [view, setView] = useState<{ s: WboDetail | null; msgs: WboMsg[] | null }>(() => ({
    s: initial ? { ...initial, messages: [], truncated: false, sends: [], asks: [] } : null,
    msgs: null,
  }));
  const { s, msgs } = view;
  const setS = useCallback(
    (fn: (now: WboDetail | null) => WboDetail | null) => setView((v) => ({ ...v, s: fn(v.s) })),
    [],
  );
  const [count, setCount] = useState(TURNS_PAGE);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [below, setBelow] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [pics, setPics] = useState<Picked[]>([]);
  const [picError, setPicError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [s2Live, setS2Live] = useState(false);
  const atBottom = useRef(true);
  const list = useRef<FlatList<Item>>(null);
  const mounted = useRef(true);
  const loading = useRef(false);
  const lastRead = useRef(0);
  const seq = useRef(0);
  const held = useRef<WboMsg[] | null>(null);
  useEffect(() => {
    held.current = msgs;
  }, [msgs]);
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

  const refresh = useCallback((): Promise<void> => {
    if (!client || loading.current) return Promise.resolve();
    loading.current = true;
    lastRead.current = Date.now();
    return client.wboSession(sid).then(
      (d) => {
        loading.current = false;
        if (!mounted.current) return;
        const was = held.current;
        const newest = d.messages[d.messages.length - 1];
        if (was?.length && newest && newest.id !== was[was.length - 1]?.id && !atBottom.current) setBelow(true);
        setView({ s: d, msgs: d.messages ?? [] });
        setError(null);
      },
      (e) => {
        loading.current = false;
        if (!mounted.current) return;
        setView((v) => (v.msgs ? v : { ...v, msgs: [] }));
        setError(fail(e, t.cantRead));
      },
    );
  }, [client, sid, fail, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The stream `wbo`: every change as it is made, laid onto what is shown.
  const hub = useLive();
  /** One record of the stream, laid on as it comes (a batch's records one after another, each on the last). */
  const apply = useCallback(
    (e: WboEvent) => {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'error' && e.session === sid) {
        refresh();
        return;
      }
      // Until the first read (or while one is on its way) only what is asked is laid on: the read has the rest.
      const early = loading.current;
      setView((v) => {
        if (early || v.msgs === null) {
          return e.type === 'ask' && e.session === sid && v.s && e.ask ? { ...v, s: putAsk(v.s, e.ask) } : v;
        }
        const got = applyWbo(v.s, v.msgs, e, sid);
        return got.s === v.s && got.msgs === v.msgs ? v : { s: got.s, msgs: got.msgs };
      });
      const fresh = e.type === 'message' && e.session === sid && !held.current?.some((m) => m.id === e.id);
      if (fresh && !atBottom.current) setBelow(true);
    },
    [sid, refresh],
  );
  useEffect(() => {
    if (!hub || !client) return;
    const f = hub.follow<WboEvent>(apply, {
      stream: 'wbo',
      every: true,
      fromTail: true,
      prepare: () => client.s2Streams(['wbo']),
      // From polling to the stream: what came in between is read once.
      onOpen: () => {
        refresh();
      },
      onLive: (l) => mounted.current && setS2Live(l),
    });
    f.start();
    return () => hub.drop(f);
  }, [hub, client, refresh, apply]);

  // The bus: a line's state, the run, what is asked. Read again (once for a burst).
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (soon.current) clearTimeout(soon.current);
    },
    [],
  );
  useBus(['wbo'], (e) => {
    if (e.k === '$down') return;
    const p = e.p as { sid?: string | null } | undefined;
    if (e.k === 'wbo' && p?.sid && p.sid !== sid) return;
    if (soon.current) return;
    soon.current = setTimeout(() => {
      soon.current = null;
      refresh();
      onChanged?.();
    }, GATHER_MS);
  });

  // Without the stream: polling, often while it works or a line waits, in the front only.
  const busy = s?.status === 'busy' || !!s?.sends?.some((m) => m.status === 'queued');
  useEffect(() => {
    if (s2Live) return;
    const timer = setInterval(
      () => {
        if (!inFront()) return;
        if (busy || Date.now() - lastRead.current > QUIET_MS) refresh();
      },
      busy ? BUSY_MS : QUIET_MS / 2,
    );
    return () => clearInterval(timer);
  }, [s2Live, busy, refresh]);

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

  // ---- answering what OpenCode asks ------------------------------------------------

  const answer = async (a: WboAsk, body: WboAnswer) => {
    if (!client || !s?.may_send) return;
    setAnswering(true);
    setError(null);
    try {
      const got = await client.wboAnswer(sid, a.id, body);
      if (mounted.current) setS((now) => (now ? putAsk(now, got) : now));
    } catch (e) {
      if (mounted.current) {
        setError(fail(e, t.notDelivered));
        refresh();
      }
    } finally {
      if (mounted.current) setAnswering(false);
    }
  };

  // ---- sending ---------------------------------------------------------------------

  const rules = s?.images ?? IMAGE_RULES;

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
    const got = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsMultipleSelection: true,
          selectionLimit: left,
        });
    if (got.canceled) return;
    const r = admit(
      pics,
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
      t,
      rules,
    );
    setPics(r.pics);
    setPicError(r.error);
  };

  const attach = () => {
    if (pics.length >= rules.max) {
      setPicError(t.atMost(rules.max));
      return;
    }
    if (Platform.OS === 'web') pick(false);
    else setPicking(true);
  };

  const send = async (text: string): Promise<boolean> => {
    if (!client || !s?.may_send) return false;
    const with_ = pics;
    if (!text && !with_.length) return false;
    setError(null);
    setNotice(null);
    setPicError(null);
    try {
      const m = await client.wboSend(
        sid,
        text,
        with_.map((p) => p.part),
      );
      if (!mounted.current) return true;
      setPics([]);
      setS((now) => (now ? { ...now, sends: [...now.sends.filter((x) => x.id !== m.id), m] } : now));
      toBottom();
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

  const sends = useMemo(() => s?.sends ?? [], [s?.sends]);
  const asks = useMemo(() => s?.asks ?? [], [s?.asks]);
  const turns = useMemo(() => buildTurns(msgs ?? [], asks), [msgs, asks]);
  const remote = useMemo(() => remoteIds(sends), [sends]);
  const pending = useMemo(() => pendingSends(sends, msgs ?? []), [sends, msgs]);
  const loose = useMemo(() => looseAsks(asks, msgs ?? []), [asks, msgs]);
  const shownTurns = turns.length > count ? turns.slice(turns.length - count) : turns;
  const more = turns.length > count;
  const items = useMemo<Item[]>(() => {
    const rows: Item[] = [];
    if (!more && s?.truncated && shownTurns.length) rows.push({ kind: 'cut' });
    shownTurns.forEach((turn, i) =>
      rows.push({ kind: 'turn', turn, same: i > 0 && shownTurns[i - 1].kind === turn.kind && turn.kind === 'user' }),
    );
    for (const a of loose) rows.push({ kind: 'ask', a });
    for (const m of pending) rows.push({ kind: 'send', m });
    return rows.reverse();
  }, [shownTurns, more, s?.truncated, loose, pending]);
  const loadOlder = () => {
    if (more) setCount((n) => n + TURNS_PAGE);
  };

  const mine = !!s && (s.mine || (!!user && s.owner.id === user.id));
  const person = mine ? user?.name || t.you : s?.owner.name || t.itsPerson;
  const dot = wboDot(s);
  const sub = [t.opencode, s?.computer, s?.directory].filter(Boolean).join(' · ');
  const canAnswer = (a: WboAsk) => a.status === 'pending' && !!s?.may_send;
  const note = s && !s.may_send ? wboWhy(s, t) : null;

  const renderItem = ({ item }: { item: Item }) => {
    if (item.kind === 'cut')
      return (
        <Text style={[st.headText, st.cut]} testID="wbo-cut">
          {t.onlyLatest}
        </Text>
      );
    if (item.kind === 'send') return <SendRow m={item.m} sid={sid} client={client} t={t} onZoom={setZoom} />;
    if (item.kind === 'ask')
      return (
        <View style={st.msgRow}>
          <AskCard a={item.a} t={t} canAnswer={canAnswer(item.a)} busy={answering} note={note} onAnswer={answer} />
        </View>
      );
    const tn = item.turn;
    if (tn.kind === 'user') {
      const sent = sendOf(sends, tn.msg.id);
      return (
        <UserRow
          m={tn.msg}
          sent={sent}
          fromHere={remote.has(tn.msg.id)}
          person={person}
          same={item.same}
          sid={sid}
          client={client}
          t={t}
          onZoom={setZoom}
        />
      );
    }
    return (
      <View style={st.msgRow} testID="wbo-answer">
        <Text style={st.headText} numberOfLines={1}>
          <Text style={st.headName}>{modelName(tn.model ?? undefined) || t.opencode}</Text>
          {tn.live ? (
            <Text style={st.live}>{`  ${tn.writing ? t.writing : t.thinking}`}</Text>
          ) : tn.ms ? (
            ` · ${secs(tn.ms)}`
          ) : (
            ''
          )}
          {tn.time ? `  ${clock(new Date(tn.time).toISOString())}` : ''}
        </Text>
        {tn.live && !tn.items.length ? <TypingDots /> : null}
        {tn.items.map((it) =>
          it.t === 'think' ? (
            <Thinking key={it.key} text={it.text} live={it.live} words={{ live: t.thinking, done: t.thought }} />
          ) : it.t === 'text' ? (
            <Markdown key={it.key} text={it.text} />
          ) : it.t === 'steps' ? (
            <Steps key={it.key} steps={it.steps} ran={t.ranTools} />
          ) : it.t === 'ask' ? (
            <AskCard
              key={it.key}
              a={it.ask}
              t={t}
              canAnswer={canAnswer(it.ask)}
              busy={answering}
              note={note}
              onAnswer={answer}
            />
          ) : (
            <Text key={it.key} style={st.error} accessibilityRole="alert">
              {it.text}
            </Text>
          ),
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']} testID="wbo-screen">
      <View style={st.head}>
        {!wide && onMenu ? (
          <IconButton icon={Menu} label={t.menu} onPress={onMenu} testID="wbo-open-drawer" />
        ) : (
          <View style={st.side} />
        )}
        <View style={st.mid}>
          <Text style={st.title} numberOfLines={1} accessibilityRole="header" testID="wbo-title">
            {s?.name || sid.slice(4, 14)}
          </Text>
          <View style={st.subRow}>
            {dot ? <StateDot s={dot} /> : null}
            <Text style={st.sub} numberOfLines={1} testID="wbo-state">
              {s ? <Text style={st.state}>{wboWord(s, t)}</Text> : null}
              {s ? ` · ${sub}` : sub}
            </Text>
          </View>
        </View>
        <IconButton icon={X} label={t.back} onPress={() => onClose?.()} testID="wbo-close" />
      </View>
      {s?.bridge?.connected && (!s.bridge.remote || s.bridge.outdated) ? (
        <View style={st.tags}>
          {!s.bridge.remote ? <Text style={st.tag}>{t.remoteOff}</Text> : null}
          {s.bridge.outdated ? (
            <Pressable
              onPress={() => setNotice(t.updateWboLong)}
              accessibilityRole="button"
              accessibilityHint={t.updateWboLong}
              testID="wbo-outdated"
            >
              <Text style={st.tag}>{t.updateWbo}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={st.flex}>
        {msgs === null && !error ? (
          <View style={st.center}>
            <ActivityIndicator color={colors.inkDim} accessibilityLabel={t.reading} />
          </View>
        ) : !items.length ? (
          error ? null : (
            <Appear fill duration={motion.enter}>
              <View style={st.empty} testID="wbo-empty">
                <Glyph icon={SquareCode} size={28} color={colors.inkDim} />
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
            testID="wbo-list"
            data={items}
            keyExtractor={(it) =>
              it.kind === 'turn'
                ? `t:${it.turn.id}`
                : it.kind === 'ask'
                  ? `a:${it.a.id}`
                  : it.kind === 'send'
                    ? `s:${it.m.id}`
                    : 'cut'
            }
            renderItem={renderItem}
            onScroll={scrolled}
            scrollEventThrottle={64}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            ListFooterComponent={
              more ? (
                <Pressable onPress={loadOlder} accessibilityRole="button" style={st.older} testID="wbo-older">
                  <Text style={st.headText}>{t.earlier}</Text>
                </Pressable>
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
          <View style={wide ? st.column : undefined} testID="wbo-composer">
            <Composer
              client={client}
              lang={lang}
              mode={voiceMode}
              writing={false}
              placeholder={t.placeholder}
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
                          testID={`wbo-unpick-${i}`}
                        >
                          <Glyph icon={X} size={12} color={colors.ink} />
                        </Pressable>
                      </View>
                    ))}
                    {picError ? (
                      <Text style={st.picError} accessibilityRole="alert" testID="wbo-pic-error">
                        {picError}
                      </Text>
                    ) : null}
                  </View>
                ) : null
              }
              tool={
                <IconButton
                  icon={Paperclip}
                  label={t.attach}
                  onPress={attach}
                  testID="wbo-attach"
                  size={20}
                  color={colors.inkDim}
                  style={st.clip}
                />
              }
            />
          </View>
        ) : (
          <View style={[st.why, wide && st.column]} accessibilityRole="text" testID="wbo-why">
            <Text style={st.whyText}>{wboWhy(s, t)}</Text>
          </View>
        )
      ) : null}
      <KeyboardSpacer />
      {picking ? (
        <Sheet onClose={() => setPicking(false)} title={t.attach} testID="wbo-pick">
          <ActionList
            actions={[
              { id: 'wbo-photos', label: t.fromPhotos, icon: Images, onPress: () => pick(false) },
              { id: 'wbo-camera', label: t.fromCamera, icon: Camera, onPress: () => pick(true) },
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

function secs(ms: number): string {
  return ms < 60_000 ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s` : `${Math.round(ms / 60_000)} min`;
}

function Pics({
  m,
  sid,
  client,
  t,
  onZoom,
}: {
  m: WboSend;
  sid: string;
  client: WorkbenchClient | null;
  t: WboStrings;
  onZoom: (uri: string) => void;
}) {
  if (!m.images?.length) return null;
  if (m.images_gone) return <Text style={[st.headText, st.right]}>{t.picturesGone}</Text>;
  return (
    <View style={st.picsRow}>
      {m.images.map((im, k) => (
        <WbcThumb
          key={im.n}
          client={client}
          path={client?.wboMessageImagePath(sid, m.id, im.n) ?? ''}
          label={`${t.picture(k + 1)}. ${t.showWhole}`}
          goneText={t.picturesGone}
          onOpen={onZoom}
          testID="wbo-pic"
        />
      ))}
    </View>
  );
}

function UserRow({
  m,
  sent,
  fromHere,
  person,
  same,
  sid,
  client,
  t,
  onZoom,
}: {
  m: WboMsg;
  sent: WboSend | null;
  fromHere: boolean;
  person: string;
  same: boolean;
  sid: string;
  client: WorkbenchClient | null;
  t: WboStrings;
  onZoom: (uri: string) => void;
}) {
  const at = m.time ? clock(new Date(m.time).toISOString()) : '';
  return (
    <View style={[st.msgRow, st.user, same && st.sameRow]} testID="wbo-user">
      <View style={st.userHead}>
        <Text style={st.headText}>{fromHere ? person : t.onComputer}</Text>
        {fromHere ? (
          <Text style={st.tag} testID="wbo-remote">
            {t.fromWorkbench}
          </Text>
        ) : null}
        {at ? <Text style={st.headText}>{at}</Text> : null}
      </View>
      {m.parts.map((p) =>
        p.type === 'text' ? (
          <View key={p.id} style={st.bubble}>
            <Text style={[st.userText, wrapAnywhere]} selectable>
              {p.text}
            </Text>
          </View>
        ) : sent?.images?.length ? null : (
          <Text key={p.id} style={[st.tag, st.mono]} numberOfLines={1}>
            {p.text}
          </Text>
        ),
      )}
      {sent ? <Pics m={sent} sid={sid} client={client} t={t} onZoom={onZoom} /> : null}
    </View>
  );
}

function SendRow({
  m,
  sid,
  client,
  t,
  onZoom,
}: {
  m: WboSend;
  sid: string;
  client: WorkbenchClient | null;
  t: WboStrings;
  onZoom: (uri: string) => void;
}) {
  const tone = sendTone(m);
  return (
    <Appear fill={false} from="below" duration={motion.fade}>
      <View style={[st.msgRow, st.user]} testID={`wbo-pending-${m.id}`}>
        <View style={st.userHead}>
          <Text style={[st.status, tone === 'ok' && st.ok, tone === 'danger' && st.danger]} testID="wbo-status">
            {sendWord(m, t, (x) => serverWords(x, t))}
          </Text>
          {m.at ? <Text style={st.headText}>{clock(isoOf(m.at))}</Text> : null}
        </View>
        {m.text ? (
          <View style={[st.bubble, st.pendingBubble]}>
            <Text style={[st.userText, wrapAnywhere]}>{m.text}</Text>
          </View>
        ) : null}
        <Pics m={m} sid={sid} client={client} t={t} onZoom={onZoom} />
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
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingVertical: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tag: {
    overflow: 'hidden',
    maxWidth: '100%',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.hover,
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    color: colors.inkDim,
  },
  mono: { fontFamily: fonts.mono },
  column: { width: '100%', maxWidth: 780, alignSelf: 'center' },
  pad: { paddingTop: space.xs, paddingBottom: space.md, flexGrow: 1 },
  older: { alignItems: 'center', paddingVertical: space.md },
  cut: { textAlign: 'center', paddingVertical: space.md },
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
  msgRow: { gap: 10, paddingHorizontal: gutter, paddingVertical: space.md },
  sameRow: { paddingTop: 0 },
  user: { alignItems: 'flex-end', gap: 4, paddingVertical: space.sm },
  userHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  headText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  headName: { fontFamily: fonts.sansMedium, color: colors.inkDim },
  live: { fontFamily: fonts.sansItalic, color: colors.inkDim },
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
  error: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 20, color: colors.danger },
  picsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
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
