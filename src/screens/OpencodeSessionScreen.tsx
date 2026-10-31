/**
 * One of one's own OpenCode sessions (backend/wbopencode.py), as the web
 * app's Chat opens it (frontend/src/app/rooms/opencode-sessions.ts), in this
 * app's own plain look: the person's own words on the right ("from
 * Workbench" on the ones sent from here, with their pictures), OpenCode's
 * answer as the Chat's answer - everything it did to get there (its thinking
 * and its tool rows) behind one line above it, opened by a tap, its words in
 * Markdown - and what OpenCode asks as a card answered from here.
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
import type { WboAnswer, WboAsk, WboDetail, WboModel, WboMsg, WboSelectedModel, WboSend, WboSession } from '../api/types';
import { Appear } from '../components/Appear';
import { ChatHeader } from '../components/ChatHeader';
import { AskCard } from '../components/AskCard';
import { Composer } from '../components/Composer';
import { Camera, Images, Info, Paperclip, SquareCode, X } from '../components/icons';
import { KeyboardSpacer } from '../components/KeyboardSpacer';
import { Markdown } from '../components/Markdown';
import { CompactWork, Steps, Thinking, TypingDots } from '../components/MessageItem';
import { NewBelow } from '../components/NewBelow';
import { ActionList, Sheet } from '../components/Sheet';
import { StateDot } from '../components/StateDot';
import { EmptyState, ErrorText, Glyph, IconButton, LoadError, wrapAnywhere } from '../components/ui';
import { PictureViewer, WbcThumb } from '../components/WbcPicture';
import { WboModelSheet } from '../components/WboModelSheet';
import { SessionPanelSheet } from '../components/SessionPanelSheet';
import { modelName } from '../components/MessageItem';
import { chatDetailStrings } from '../lib/chatDetail';
import { bottomReader, followBottom, KEEP_PLACE } from '../lib/stickBottom';
import { footFlag, shortK } from '../lib/wboPanel';
import { ago } from '../lib/time';
import { admit, IMAGE_RULES, pickedOf, serverWords, type Picked } from '../lib/wbc';
import { readPictureHead } from '../lib/pictureFile';
import {
  applyWbo,
  buildTurns,
  localWhy,
  looseAsks,
  pendingSends,
  putAsk,
  remoteIds,
  sendOf,
  sendTone,
  sendWord,
  TURNS_PAGE,
  updateWord,
  provName,
  wboDot,
  wboWhy,
  wboWord,
  type Turn,
  type TurnItem,
  type WboEvent,
} from '../lib/wbo';
import type { WboStrings } from '../lib/wboStrings';
import { inFront } from '../live/hub';
import { useBus, useLive } from '../live/LiveContext';
import { colors, fonts, gutter, indicatorStyle, motion, radius, space, type } from '../theme/tokens';
import { uiLang } from '../update/strings';
import type { VoiceMode } from '../voice/voice';

/** Without the stream: read this often while OpenCode works or a line waits. */
const BUSY_MS = 2000;
/** Otherwise this often. */
const QUIET_MS = 10_000;
/** A burst of bus events is read once, this long after the first. */
const GATHER_MS = 150;

type Item =
  | { kind: 'turn'; turn: Turn; same: boolean }
  | { kind: 'ask'; a: WboAsk }
  | { kind: 'send'; m: WboSend }
  | { kind: 'cut' };

/** OpenCode's answer as one row: the stats under it are its steps together. */
type AnswerTurn = Extract<Turn, { kind: 'assistant' }>;

export function OpencodeSessionScreen({
  sid,
  client,
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
  /** The session could not be read: what it said, and the way to try again. */
  const [error, setError] = useState<string | null>(null);
  /** A line or an answer could not be sent: told beside the box, while the box has it back. */
  const [sendError, setSendError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [below, setBelow] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [pics, setPics] = useState<Picked[]>([]);
  const [picError, setPicError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  /** The session's column, opened by the "i" (rooms/session-panel.ts in the web app, the same answer). */
  const [column, setColumn] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [s2Live, setS2Live] = useState(false);
  const list = useRef<FlatList<Item>>(null);
  /** Who is reading the bottom of the thread, told by their finger alone (lib/stickBottom.ts). */
  const reader = useMemo(() => bottomReader(), []);
  /** A message arriving, or one being written, while the reader is at the bottom: stay there. */
  const follow = useCallback(() => followBottom(list.current, reader.atBottom), [reader]);
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
        if (was?.length && newest && newest.id !== was[was.length - 1]?.id && !reader.atBottom()) setBelow(true);
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
  }, [client, sid, fail, t, reader]);

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
      if (fresh && !reader.atBottom()) setBelow(true);
    },
    [sid, refresh, reader],
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

  // ---- answering what OpenCode asks ------------------------------------------------

  const answer = async (a: WboAsk, body: WboAnswer) => {
    if (!client || !s?.may_send) return;
    setAnswering(true);
    setSendError(null);
    try {
      const got = await client.wboAnswer(sid, a.id, body);
      if (mounted.current) setS((now) => (now ? putAsk(now, got) : now));
    } catch (e) {
      if (mounted.current) {
        setSendError(fail(e, t.notDelivered));
        refresh();
      }
    } finally {
      if (mounted.current) setAnswering(false);
    }
  };

  // ---- sending ---------------------------------------------------------------------

  const rules = s?.images ?? IMAGE_RULES;

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
    setSendError(null);
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
        setSendError(fail(e, t.notDelivered));
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

  /** A row in the column was tapped: close it and put the call it is about in the middle. A call in a turn
   *  that is not loaded yet (the list shows the latest ones) scrolls nowhere until "Show earlier" brings it
   *  in: the column's own answer is the newest call, which is what is on screen. */
  const jumpTo = (message: string) => {
    setColumn(false);
    const at = items.findIndex(
      (it) => it.kind === 'turn' && it.turn.kind === 'assistant' && it.turn.steps.some((m) => m.id === message),
    );
    if (at < 0) return;
    setTimeout(() => list.current?.scrollToIndex({ index: at, viewPosition: 0.5, animated: true }), 60);
  };

  /** The detail setting's words, in the app's language. */
  const dw = chatDetailStrings(uiLang(lang));
  const dot = wboDot(s);
  // Where it runs is the header's business now (the sheet keeps the folder): "OpenCode · x33-workstation".
  const computerName = s?.bridge?.host || s?.computer || '';
  const sub = [t.opencode, computerName].filter(Boolean).join(' · ');
  /** A newer wb-opencode (connected or not), or an MCP server that fell off: one small warn word in the line. */
  const subFlag = s?.bridge?.outdated
    ? { text: t.updateShort, tip: t.updateWboLong }
    : s?.bridge ? footFlag(s.bridge) : null;
  const canAnswer = (a: WboAsk) => a.status === 'pending' && !a.local && !!s?.may_send;
  const why = s && !s.may_send ? wboWhy(s, t) : null;

  const [modelSheet, setModelSheet] = useState(false);
  const allModels = useMemo<WboModel[]>(() => s?.bridge?.models || s?.models || [], [s]);
  const selectedModel = useMemo<WboSelectedModel | null>(() => {
    if (!s) return null;
    if (s.selected_model && typeof s.selected_model === 'object') return s.selected_model;
    if (s.model && typeof s.model === 'object') return s.model as WboSelectedModel;
    if (typeof s.model === 'string' && s.model) return { providerID: '', modelID: s.model };
    return null;
  }, [s]);

  /** What its last step was sent of the model's window, short - the column's own line in the Chat. */
  const contextLabel = useMemo(() => {
    const c = s?.context;
    if (!c || (!c.used && !c.limit)) return '';
    return `${shortK(c.used)} / ${c.limit ? shortK(c.limit) : '?'}`;
  }, [s?.context]);

  const modelDisabled = useMemo(() => {
    if (!s) return true;
    if (!s.bridge?.connected) return true;
    if (!s.bridge.remote) return true;
    if (s.bridge.models_supported === false) return true;
    if (!s.mine) return true;
    return false;
  }, [s]);

  const modelDisabledReason = useMemo(() => {
    if (!s) return '';
    if (!s.bridge?.connected) return t.notConnectedComp;
    if (!s.bridge.remote) return t.remoteOffComp;
    if (s.bridge.models_supported === false) return t.updateWboModels;
    if (!s.mine) return t.onlyOwnerCanChoose;
    return '';
  }, [s, t]);

  const modelLabel = useMemo(() => {
    if (selectedModel?.name) {
      return selectedModel.providerName ? `${selectedModel.name} · ${selectedModel.providerName}` : selectedModel.name;
    }
    if (selectedModel?.modelID) {
      const mName = modelName(selectedModel.modelID);
      return selectedModel.providerName ? `${mName} · ${selectedModel.providerName}` : mName;
    }
    return t.model;
  }, [selectedModel, t.model]);

  /** The window this session keeps to (a smaller one makes OpenCode compact sooner): its own route, the same
   *  one the web's column uses; the sheet reads the session again and the bar is drawn against it. */
  const pickContext = async (limit: number | null) => {
    if (!client) return;
    try {
      await client.wboContext(sid, limit);
      if (s?.status === 'busy') setNotice(t.appliesNextMessage);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'The context window could not be changed.');
    }
  };

  const pickModel = async (providerID: string, modelID: string, variant?: string) => {
    if (!client) return;
    const match = allModels.find((m) => m.providerID === providerID && m.modelID === modelID);
    const newModel: WboSelectedModel = {
      providerID,
      providerName: match?.providerName || providerID,
      modelID,
      name: match?.name || modelID,
      variant,
    };
    const was = s?.selected_model;
    setS((now) => (now ? { ...now, selected_model: newModel } : now));
    try {
      await client.wboSelectModel(sid, { providerID, modelID, variant });
      if (s?.status === 'busy') {
        setNotice(t.appliesNextMessage);
      }
    } catch (e) {
      setS((now) => (now ? { ...now, selected_model: was } : now));
      setSendError(e instanceof Error ? e.message : 'The model could not be changed.');
    }
  };

  const asstModelText = (tn: AnswerTurn) => {
    const m = tn.model ? modelName(tn.model) : 'OpenCode';
    const prov = provName(tn.provider);
    return prov && prov !== 'Workbench' ? `${m} · ${prov}` : m;
  };
  // A question drawn from the tool's own call says why it is not answered here; any other, why one cannot write.
  const noteOf = (a: WboAsk) => (a.local ? localWhy(s, t) : why);
  const update = updateWord(s, t);
  /** The header's word: the dot says it alone while OpenCode works - it is
   *  the dot that pulses - and the word would say it twice (as the web). */
  const head = s && s.status !== 'busy' ? wboWord(s, t) : '';
  /**
   * An answer's thinking and tool rows apart from its words, with what the one
   * line they are written as while the Chat is compact says (Settings > Chat;
   * the web's folded() in rooms/opencode-sessions.ts).
   */
  const split = (tn: AnswerTurn) => {
    const work = tn.items.filter((it) => it.t === 'think' || it.t === 'steps');
    const rest = tn.items.filter((it) => it.t !== 'think' && it.t !== 'steps');
    const tools = work.reduce((n, it) => n + (it.t === 'steps' ? it.steps.length : 0), 0);
    const thought = work.reduce((n, it) => n + (it.t === 'think' ? it.text.length : 0), 0);
    const ms = work.reduce<number | null>(
      (n, it) => (it.t === 'think' && it.ms != null ? (n ?? 0) + it.ms : n),
      null,
    );
    return { work, rest, tools, thought, ms };
  };
  /** One piece of an answer as it is drawn; `open` is a Chat set to detailed. */
  const drawn = (it: TurnItem, open: boolean) =>
    it.t === 'think' ? (
      <Thinking
        key={`${it.key}:${open ? 'open' : 'folded'}`}
        text={it.text}
        live={it.live}
        open={open}
        words={{ live: t.thinking, done: t.thought }}
      />
    ) : it.t === 'text' ? (
      <Markdown key={it.key} text={it.text} />
    ) : it.t === 'steps' ? (
      <Steps
        key={`${it.key}:${open ? 'open' : 'folded'}`}
        steps={it.steps}
        ran={t.ranTools}
        detail={open ? 'detailed' : 'normal'}
      />
    ) : it.t === 'ask' ? (
      <AskCard
        key={it.key}
        a={it.ask}
        t={t}
        canAnswer={canAnswer(it.ask)}
        busy={answering}
        note={noteOf(it.ask)}
        onAnswer={answer}
      />
    ) : (
      <Text key={it.key} style={st.error} accessibilityRole="alert">
        {it.text}
      </Text>
    );

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
          <AskCard
            a={item.a}
            t={t}
            canAnswer={canAnswer(item.a)}
            busy={answering}
            note={noteOf(item.a)}
            onAnswer={answer}
          />
        </View>
      );
    const tn = item.turn;
    if (tn.kind === 'system') {
      const m = tn.msg;
      const modObj = m.model && typeof m.model === 'object' ? (m.model as any) : null;
      const prevObj = m.previous && typeof m.previous === 'object' ? (m.previous as any) : null;
      const toModel = modObj ? (modObj.name || modObj.modelID || modObj.id || '') : (m.model ? modelName(String(m.model)) : '…');
      const fromModel = prevObj ? (prevObj.name || prevObj.modelID || prevObj.id || '') : (m.previous ? modelName(String(m.previous)) : t.initial);
      const who = m.by === 'chat' ? t.fromChat : t.onComp;
      return (
        <View style={st.sysRow} key={tn.id} testID="wbo-system-row">
          <Text style={st.sysText}>{t.modelSwitched(String(fromModel || t.initial), String(toModel || '…'), who)}</Text>
        </View>
      );
    }
    if (tn.kind === 'user') {
      const sent = sendOf(sends, tn.msg.id);
      return (
        <UserRow
          m={tn.msg}
          sent={sent}
          fromHere={remote.has(tn.msg.id)}
          same={item.same}
          sid={sid}
          client={client}
          t={t}
          onZoom={setZoom}
        />
      );
    }
    const { work, rest, tools, thought, ms } = split(tn);
    return (
      <View style={st.msgRow} testID="wbo-answer">
        <Text style={st.asstModel} numberOfLines={1}>
          {asstModelText(tn)}
        </Text>
        {tn.live && !tn.items.length ? <TypingDots /> : null}
        {/* What it did to get there - its thinking and its tool rows - on one
            line, opened by a tap; then the answer and what it asks. */}
        {work.length ? (
          <CompactWork tools={tools} thinking={thought} ms={ms} dw={dw}>
            {work.map((it) => drawn(it, true))}
          </CompactWork>
        ) : null}
        {rest.map((it) => drawn(it, false))}
      </View>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right', 'bottom']} testID="wbo-screen">
      <ChatHeader
        title={s?.name || sid.slice(4, 14)}
        lang={lang}
        client={client}
        wide={wide}
        onMenu={onMenu}
        menuTestID="wbo-open-drawer"
        titleTestID="wbo-title"
        right={
          <>
            <IconButton
              icon={Info}
              label={t.columnAria}
              onPress={() => setColumn(true)}
              testID="wbo-column"
            />
            <IconButton icon={X} label={t.back} onPress={() => onClose?.()} testID="wbo-close" />
          </>
        }
        sub={
          /* The cell says the state and where it runs ("ready · OpenCode · x33-workstation"); the sheet says
             the folder, the model and the window while it is open - one fact, one place. */
          column ? null : (
            <>
              {dot ? <StateDot s={dot} /> : null}
              {/* The state gives way first: where it runs is the fact this line is for. */}
              <View style={st.stateLine} testID="wbo-state">
                {s && head ? (
                  <Text style={st.state} numberOfLines={1}>
                    {head}
                  </Text>
                ) : null}
                <Text style={st.sub} numberOfLines={1}>
                  {s && head ? ` · ${sub}` : sub}
                </Text>
              </View>
              {subFlag ? (
                // The one thing wrong with that computer: an old wb-opencode, an MCP server that fell off.
                <Pressable
                  onPress={() => setNotice(subFlag.tip)}
                  accessibilityRole="button"
                  accessibilityLabel={subFlag.tip}
                  accessibilityHint={subFlag.tip}
                  hitSlop={6}
                  testID="wbo-flag"
                >
                  <Text style={st.subFlag} numberOfLines={1}>
                    {subFlag.text}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )
        }
        below={
          s?.bridge?.connected && !s.bridge.remote ? (
            <View style={st.tags}>
              <Text style={st.tag}>{t.remoteOff}</Text>
            </View>
          ) : null
        }
      />
      <View style={st.flex}>
        {msgs === null && !error ? (
          <View style={st.center}>
            <ActivityIndicator color={colors.inkDim} accessibilityLabel={t.reading} />
          </View>
        ) : !items.length ? (
          error ? (
            <LoadError text={error} onRetry={refresh} retryLabel={t.retry} centered />
          ) : (
            <EmptyState icon={SquareCode} title={s?.name || t.session} text={t.nothingYet} testID="wbo-empty" />
          )
        ) : (
          <FlatList
            ref={list}
            inverted
            indicatorStyle={indicatorStyle}
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
      {error || sendError || notice ? (
        <View style={[st.msg, wide && st.column]}>
          {error ? (
            <LoadError text={error} onRetry={refresh} retryLabel={t.retry} />
          ) : sendError ? (
            <ErrorText>{sendError}</ErrorText>
          ) : (
            <Text style={st.note}>{notice}</Text>
          )}
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
              draftKey={`wbo:${sid}`}
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
              meta={
                <>
                  <Pressable
                    style={[st.modelChip, modelDisabled && st.modelDisabled]}
                    onPress={() => {
                      if (modelDisabled) {
                        if (modelDisabledReason) setNotice(modelDisabledReason);
                        return;
                      }
                      setModelSheet(true);
                    }}
                    testID="wbo-model-picker"
                    accessibilityRole="button"
                    accessibilityLabel={modelLabel}
                  >
                    <Text style={[st.modelChipText, modelDisabled && st.modelChipDisabled]} numberOfLines={1}>
                      {modelLabel}
                    </Text>
                  </Pressable>
                  {contextLabel ? (
                    <Text style={st.metaContext} numberOfLines={1} testID="wbo-context">
                      {contextLabel}
                    </Text>
                  ) : null}
                </>
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
      {modelSheet ? (
        <WboModelSheet
          models={allModels}
          selected={selectedModel}
          lang={lang}
          onClose={() => setModelSheet(false)}
          onPick={pickModel}
        />
      ) : null}
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
      {column ? (
        <SessionPanelSheet
          client={client}
          sid={sid}
          t={t}
          onClose={() => setColumn(false)}
          onJump={jumpTo}
          onAnswer={(a, decision) => void answer(a, { decision })}
          onModel={() => {
            setColumn(false);
            setModelSheet(true);
          }}
          onContext={(limit) => void pickContext(limit)}
          when={(at) => (at ? ago(new Date(at).toISOString(), new Date(), uiLang(lang)) : '')}
        />
      ) : null}
      {zoom ? (
        <PictureViewer uri={zoom} label={t.showWhole} closeLabel={t.close} onClose={() => setZoom(null)} />
      ) : null}
    </SafeAreaView>
  );
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
  same,
  sid,
  client,
  t,
  onZoom,
}: {
  m: WboMsg;
  sent: WboSend | null;
  fromHere: boolean;
  same: boolean;
  sid: string;
  client: WorkbenchClient | null;
  t: WboStrings;
  onZoom: (uri: string) => void;
}) {
  return (
    <View style={[st.msgRow, st.user, same && st.sameRow]} testID="wbo-user">
      {fromHere ? (
        <Text style={st.headText} testID="wbo-remote">
          {t.fromWorkbench}
        </Text>
      ) : null}
      {m.parts.map((p) =>
        p.type === 'text' ? (
          <Text key={p.id} style={[st.userText, wrapAnywhere]} selectable>
            {p.text}
          </Text>
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
        <Text style={[st.status, tone === 'ok' && st.ok, tone === 'danger' && st.danger]} testID="wbo-status">
          {sendWord(m, t, (x) => serverWords(x, t))}
        </Text>
        {m.text ? <Text style={[st.userText, wrapAnywhere]}>{m.text}</Text> : null}
        <Pics m={m} sid={sid} client={client} t={t} onZoom={onZoom} />
      </View>
    </Appear>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  state: { flexShrink: 1, fontFamily: fonts.sansMedium, color: colors.ink },
  stateLine: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
  sub: { flexShrink: 0, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  subFlag: { flexShrink: 0, fontFamily: fonts.mono, fontSize: type.micro, color: colors.warn },
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
  pad: { paddingTop: space.xl, paddingBottom: space.md, flexGrow: 1 },
  older: { alignItems: 'center', paddingVertical: space.md },
  cut: { textAlign: 'center', paddingVertical: space.md },
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
  msgRow: { gap: 10, paddingHorizontal: gutter, paddingVertical: space.md },
  sameRow: { paddingTop: 0 },
  // The person's own words, on the right and plainly: no bubble, no name over it.
  user: { alignItems: 'flex-end', gap: 4, paddingVertical: space.sm },
  headText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
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
  error: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.danger },
  picsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
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
  metaContext: { marginLeft: 'auto', fontFamily: fonts.mono, fontSize: type.micro, color: colors.inkDim },
  modelChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.round,
    backgroundColor: colors.hover,
    flexShrink: 1,
    maxWidth: 200,
  },
  modelDisabled: { opacity: 0.6 },
  modelChipText: {
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    color: colors.ink,
  },
  modelChipDisabled: { color: colors.inkDim },
  sysRow: {
    paddingVertical: 6,
    paddingHorizontal: gutter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sysText: {
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    color: colors.inkDim,
    backgroundColor: colors.surface2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.round,
    overflow: 'hidden',
  },
  asstHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  asstModel: {
    fontFamily: fonts.sansSemi,
    fontSize: type.tiny,
    color: colors.inkDim,
  },
});
