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
import { ChatHeader } from '../components/ChatHeader';
import { Composer } from '../components/Composer';
import { Camera, Images, Paperclip, SquareTerminal, X } from '../components/icons';
import { KeyboardSpacer } from '../components/KeyboardSpacer';
import { Markdown } from '../components/Markdown';
import { NewBelow } from '../components/NewBelow';
import { NoticeTurn } from '../components/NoticeTurn';
import { ActionList, Sheet } from '../components/Sheet';
import { StateDot } from '../components/StateDot';
import { TeamSheet } from '../components/TeamSheet';
import { EmptyState, ErrorText, Glyph, IconButton, LoadError, wrapAnywhere } from '../components/ui';
import { PictureViewer, WbcThumb } from '../components/WbcPicture';
import { parseNotice } from '../lib/notice';
import { bottomReader, followBottom, KEEP_PLACE } from '../lib/stickBottom';
import { teamStrings } from '../lib/teamStrings';
import {
  admit,
  IMAGE_RULES,
  layTurns,
  liveDot,
  MARK,
  pendingOf,
  pickedOf,
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
import { readPictureHead } from '../lib/pictureFile';
import type { WbcStrings } from '../lib/wbcStrings';
import { inFront } from '../live/hub';
import { useBus, useLive } from '../live/LiveContext';
import { colors, fonts, gutter, indicatorStyle, motion, radius, space, touch, type } from '../theme/tokens';
import { uiLang } from '../update/strings';
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
  teamCount = 0,
  onMenu,
  onClose,
  onChanged,
  onOpenAgent,
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
  /** How many sessions are under this one: the Team button is there only for a manager (docs/AGENTS.md). */
  teamCount?: number;
  onMenu?: () => void;
  onClose?: () => void;
  /** Its state changed (the drawer's row). */
  onChanged?: () => void;
  /** A row of its Team was tapped: that agent's own session ("wbc:<id>" / "wbo:<id>") takes the screen. */
  onOpenAgent?: (key: string) => void;
}) {
  /** Its Team, in a sheet: the agents under it and the tasks it gave them. */
  const [team, setTeam] = useState(false);
  const teamT = useMemo(() => teamStrings(uiLang(lang)), [lang]);
  const [s, setS] = useState<WbcDetail | null>(() => (initial ? { ...initial, messages: [], mark: MARK } : null));
  const [turns, setTurns] = useState<WbcTurn[] | null>(null);
  const [more, setMore] = useState(false);
  const [older, setOlder] = useState(false);
  /** The session could not be read: what it said, and the way to try again. */
  const [error, setError] = useState<string | null>(null);
  /** A line could not be sent: told beside the box, while the box has it back. */
  const [sendError, setSendError] = useState<string | null>(null);
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
  const list = useRef<FlatList<Item>>(null);
  /** Who is reading the bottom of the thread, told by their finger alone (lib/stickBottom.ts). */
  const reader = useMemo(() => bottomReader(), []);
  /** A turn arriving, or one being written, while the reader is at the bottom: stay there. */
  const follow = useCallback(() => followBottom(list.current, reader.atBottom), [reader]);
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
        if (held?.length && newest && (!was || turnKey(newest) !== turnKey(was)) && !reader.atBottom()) setBelow(true);
        setTurns((now) => (sameTurns(now, next) ? now : next));
        setSuggestion(page.suggestion || null);
      },
      (e) => {
        if (!mounted.current) return;
        setTurns((now) => now ?? []);
        setError(fail(e, t.cantRead));
      },
    );
  }, [client, sid, fail, t, reader]);

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
    try {
      if (camera) {
        const ok = await ImagePicker.requestCameraPermissionsAsync();
        if (!ok.granted) {
          setPicError(t.noCamera);
          return;
        }
      }
      const left = Math.max(1, rules.max - pics.length);
      // Both are written afresh by the picker below full quality: a phone's photo is often over
      // 5 MB, or a HEIC (Samsung, iPhone) the server does not take - it comes back a JPEG.
      const got = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            allowsMultipleSelection: true,
            selectionLimit: left,
          });
      if (got.canceled || !got.assets?.length) return;
      const now = Date.now();
      add(got.assets.map((a, i) => pickedOf(a, i, `p${++seq.current}`, readPictureHead(a.uri), now)));
    } catch {
      if (mounted.current) setPicError(t.pickFailed);
    }
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
    setSendError(null);
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
        setSendError(fail(e, t.notDelivered));
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
        t={t}
        onZoom={setZoom}
      />
    ) : (
      <PendingRow m={item.m} sid={sid} client={client} t={t} onZoom={setZoom} />
    );

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']} testID="wbc-screen">
      <ChatHeader
        title={s?.name || sid.slice(0, 8)}
        lang={lang}
        client={client}
        wide={wide}
        onMenu={onMenu}
        menuTestID="wbc-open-drawer"
        titleTestID="wbc-title"
        right={
          <>
            {/* Only a manager has a team: the agents it was given, and the work it gave them. */}
            {teamCount > 0 ? (
              <Pressable
                onPress={() => setTeam(true)}
                accessibilityRole="button"
                accessibilityLabel={teamT.openTeam}
                accessibilityHint={teamT.agents}
                hitSlop={8}
                style={st.teamBtn}
                testID="wbc-team"
              >
                <Text style={st.teamText}>{teamT.openTeam}</Text>
              </Pressable>
            ) : null}
            <IconButton icon={X} label={t.back} onPress={() => onClose?.()} testID="wbc-close" />
          </>
        }
        sub={
          <>
            {dot ? <StateDot s={dot} /> : null}
            {/* One line: what Claude does now in ink, then where, cut at the end. */}
            <Text style={st.sub} numberOfLines={1} testID="wbc-state">
              {s ? <Text style={st.state}>{stateWord(s, t)}</Text> : null}
              {s ? ` · ${sub}` : sub}
            </Text>
          </>
        }
        below={
          s?.bridge?.connected && (!s.bridge.remote || s.bridge.outdated) ? (
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
          ) : null
        }
      />
      <View style={st.flex}>
        {turns === null && !error ? (
          <View style={st.center}>
            <ActivityIndicator color={colors.inkDim} accessibilityLabel={t.reading} />
          </View>
        ) : !items.length ? (
          error ? (
            <LoadError text={error} onRetry={() => refresh(true)} retryLabel={t.retry} centered />
          ) : (
            <EmptyState icon={SquareTerminal} title={s?.name || t.session} text={t.nothingYet} testID="wbc-empty" />
          )
        ) : (
          <FlatList
            ref={list}
            inverted
            indicatorStyle={indicatorStyle}
            testID="wbc-list"
            data={items}
            keyExtractor={(it) => (it.kind === 'turn' ? `t:${turnKey(it.turn)}` : `m:${it.m.id}`)}
            renderItem={renderItem}
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
      {error || sendError || notice ? (
        <View style={[st.msg, wide && st.column]}>
          {error ? (
            <LoadError text={error} onRetry={() => refresh(true)} retryLabel={t.retry} />
          ) : sendError ? (
            <ErrorText>{sendError}</ErrorText>
          ) : (
            <Text style={st.note}>{notice}</Text>
          )}
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
              draftKey={`wbc:${sid}`}
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
      {team ? (
        <TeamSheet
          client={client}
          sid={sid}
          t={teamT}
          sub={s?.name || undefined}
          onClose={() => setTeam(false)}
          onOpenAgent={(key) => {
            setTeam(false);
            onOpenAgent?.(key);
          }}
        />
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
  t,
  onZoom,
}: {
  turn: WbcTurn;
  same: boolean;
  sid: string;
  client: WorkbenchClient | null;
  mark: string;
  t: WbcStrings;
  onZoom: (uri: string) => void;
}) {
  const paths = (turn.images ?? []).map((p) => client?.wbcTurnImagePath(sid, p.req, p.n) ?? '');
  // The whole of it, once somebody asked: a page of turns carries the first part of a long one and says how
  // much more there is (backend/wbclaude.py) - the answer is never cut in silence.
  const [full, setFull] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<number | null>(null);
  useEffect(() => {
    setFull(null);
    setGone(null);
    setBusy(false);
  }, [turn.id, turn.role, turn.text]);
  const more = Math.max(0, (turn.full_len ?? turn.text.length) - (turn.cut_at ?? turn.text.length));
  const openable = !!turn.truncated && more > 0 && full === null && gone === null;
  const open = async () => {
    if (!client || busy) return;
    setBusy(true);
    try {
      const got = await client.wbcTurnText(sid, turn.id, turn.role);
      if (got.text) setFull(got.text);
      if (!got.available) setGone(got.kept || got.text.length || turn.text.length);
    } catch {
      setGone(turn.text.length);
    } finally {
      setBusy(false);
    }
  };
  const words = full ?? turn.text;
  const moreLine = openable ? (
    <Pressable onPress={open} disabled={busy} accessibilityRole="button" style={st.more} testID="wbc-more">
      <Text style={st.moreText} numberOfLines={1}>
        {busy ? t.readingWhole : t.moreChars(more.toLocaleString())}
      </Text>
      {busy ? null : <Text style={st.moreOpen}>{t.showAll}</Text>}
    </Pressable>
  ) : gone !== null ? (
    <Text style={st.moreGone} testID="wbc-more-gone">
      {t.onlyFirst(gone.toLocaleString())}
    </Text>
  ) : turn.maybe ? (
    <Text style={st.moreGone} testID="wbc-more-maybe">
      {t.maybeCut}
    </Text>
  ) : null;
  if (turn.role === 'user') {
    const noticeTasks = parseNotice(words);
    if (noticeTasks) {
      const isTr = t.fromWorkbench === "Workbench'ten";
      return (
        <NoticeTurn
          tasks={noticeTasks}
          lang={isTr ? 'tr' : 'en'}
          testID="wbc-turn-notice"
        />
      );
    }
    const shown = unmark(words, mark);
    return (
      <View style={[st.msgRow, st.user]} testID="wbc-turn-user">
        {turn.remote ? (
          <Text style={st.tag} testID="wbc-remote">
            {t.fromWorkbench}
          </Text>
        ) : null}
        {shown ? (
          <Text style={[st.userText, wrapAnywhere]} selectable>
            {shown}
          </Text>
        ) : null}
        {moreLine}
        {paths.length ? <Pics paths={paths} client={client} t={t} onZoom={onZoom} right /> : null}
      </View>
    );
  }
  return (
    <View style={[st.msgRow, same && st.sameRow]} testID="wbc-turn-answer">
      <Markdown text={words} />
      {turn.cut ? <Text style={st.headText}>{t.cut}</Text> : null}
      {moreLine}
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
        <Text style={[st.status, tone === 'ok' && st.ok, tone === 'danger' && st.danger]} testID="wbc-status">
          {statusWord(m, t)}
        </Text>
        {m.text ? <Text style={[st.userText, wrapAnywhere]}>{m.text}</Text> : null}
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
  /* the line under a text that is longer than the page carried: how much more there is, and the way to it */
  more: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, alignSelf: 'flex-start', marginTop: space.xs,
          paddingHorizontal: space.sm, paddingVertical: 2, borderWidth: 1, borderStyle: 'dashed',
          borderColor: colors.line, borderRadius: radius.sm },
  moreText: { flexShrink: 1, fontSize: type.micro, color: colors.inkDim },
  moreOpen: { fontSize: type.micro, color: colors.accent },
  moreGone: { marginTop: space.xs, fontSize: type.micro, color: colors.warn },
  teamBtn: { minHeight: touch, justifyContent: 'center', paddingHorizontal: space.sm },
  teamText: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.inkDim },
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
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
    lineHeight: type.smallLine,
    color: colors.inkDim,
    textAlign: 'center',
  },
  msgRow: { gap: 8, paddingHorizontal: gutter, paddingVertical: space.md },
  sameRow: { paddingTop: 0 },
  user: { alignItems: 'flex-end', gap: 4, paddingVertical: space.sm },
  headText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  // The person's own words, on the right and plainly: no bubble, no name over it.
  userText: {
    maxWidth: '92%',
    textAlign: 'right',
    fontFamily: fonts.sans,
    fontSize: type.body,
    lineHeight: type.bodyLine,
    color: colors.inkBright,
  },
  status: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, textAlign: 'right' },
  ok: { color: colors.ok },
  danger: { color: colors.danger },
  pics: { gap: 4 },
  picsRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  picsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  picsNote: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  right: { textAlign: 'right' },
  msg: { paddingHorizontal: gutter, paddingVertical: space.xs },
  note: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.inkDim },
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
  whyText: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.inkDim },
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
  picError: { flexBasis: '100%', fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.danger },
  clip: { width: 40, height: 40 },
});
