/**
 * The Orchestrator, read-only (the web app's rooms/orchestrator-room.ts): what
 * one's own Orchestrator - the agent on the server that answers in every
 * room - does, live. Nobody writes here: people write in the rooms and it
 * answers there, so there is no box to type in.
 *
 * Its session is read once (GET /api/me/orchestrator/sessions/{sid}) and kept
 * up by OpenCode's own event stream (GET /api/me/orchestrator/events): text
 * and thinking as they are written, each tool call a compact row that opens
 * to its input and output, and a line said in a room as "Answered in 3D
 * Drawing". Its sub-agents are a tree (GET .../tree): a section to fold
 * open above the session on a phone, a column beside it on a wide screen;
 * a sub-agent's session opens in place, with the way back above it.
 *
 * The top bar has its state and model, "MCP <version>" - which lists every
 * tool of Workbench's MCP server - and Settings: Agent & LLM, where it is
 * given a model and started or stopped. When it is not running, its key was
 * refused, its credits ran out or it keeps crashing, a banner says so.
 */
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WorkbenchClient } from '../api/client';
import type { AgentState, AgentTree, OrchEvent, OrchMessage, OrchPart, OrchStatus, OrchTranscript } from '../api/types';
import { AgentSheet } from '../components/AgentSheet';
import { Appear } from '../components/Appear';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Network, Settings } from '../components/icons';
import { Markdown } from '../components/Markdown';
import { McpSheet } from '../components/McpSheet';
import { NewBelow } from '../components/NewBelow';
import { modelName } from '../components/MessageItem';
import { StateDot } from '../components/StateDot';
import { Glyph, IconButton, wrapAnywhere } from '../components/ui';
import {
  applyEvent,
  author,
  busyAgents,
  clockOf,
  haltTitle,
  isLive,
  nodeTime,
  reasonText,
  said,
  span,
  stateWord,
  statusDot,
  stepText,
  toolArgs,
  toolName,
  toolState,
  treeRows,
  type TreeRow,
} from '../lib/orchestrator';
import type { OrchStrings } from '../lib/orchStrings';
import { PAGE } from '../lib/paging';
import { colors, fonts, gutter, motion, radius, space, touch, type } from '../theme/tokens';

/** How often the state is read again, and the tree when the stream says nothing of it. */
const STATUS_EVERY = 5000;
const TREE_EVERY = 15000;
/** The stream is opened afresh this often, so what it has carried does not pile up in memory. */
const RECYCLE_MS = 5 * 60_000;
/** At least this wide, the tree is a column beside the session (the web app's 760 px). */
const SIDE_AT = 760;

export interface OrchestratorHandle {
  /** Back: from a sub-agent's session to the Orchestrator's own. True when it went somewhere. */
  back(): boolean;
}

export const OrchestratorScreen = forwardRef<
  OrchestratorHandle,
  {
    client: WorkbenchClient | null;
    t: OrchStrings;
    lang: 'en' | 'tr';
    wide?: boolean;
    onMenu?: () => void;
    /** The state as the drawer last read it, to show before the first look. */
    initial?: OrchStatus | null;
    onStatus?: (s: OrchStatus) => void;
  }
>(function OrchestratorScreen({ client, t, lang, wide = false, onMenu, initial = null, onStatus }, ref) {
  const [st, setSt] = useState<OrchStatus | null>(initial);
  const [tree, setTree] = useState<AgentTree | null>(null);
  const [view, setView] = useState<string | null>(null);
  /** The transcript read, by the session it is of: only the one shown is drawn. */
  const [txOf, setTxOf] = useState<{ sid: string; x: OrchTranscript } | null>(null);
  const [lost, setLost] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [treeOpen, setTreeOpen] = useState(false);
  const [sheet, setSheet] = useState<'mcp' | 'agent' | null>(null);
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<OrchMessage>>(null);
  /** At the newest line (the list is upside down: offset 0 is the bottom), so kept there. */
  const atBottom = useRef(true);
  const [below, setBelow] = useState(false);
  /** How many of the session's messages are drawn, by session: the newest ten, ten more as the reader nears the top. */
  const [countOf, setCountOf] = useState<{ sid: string | null; n: number }>({ sid: null, n: PAGE });
  const mounted = useRef(true);

  const root = tree?.root ?? st?.session ?? null;
  const shown = view ?? root;
  const tx = txOf && txOf.sid === shown ? txOf.x : null;
  const count = countOf.sid === shown ? countOf.n : PAGE;
  const drawn = useMemo(() => (tx ? tx.messages.slice(-count).reverse() : []), [tx, count]);
  const hidden = tx ? Math.max(0, tx.messages.length - count) : 0;
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);
  const running = st?.desired === 'running';
  const side = width >= SIDE_AT;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    back: () => {
      if (sheet) {
        setSheet(null);
        return true;
      }
      if (view) {
        setView(null);
        return true;
      }
      return false;
    },
  }));

  const loadStatus = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.orchestrator().then(
      (got) => {
        if (!mounted.current) return;
        setSt(got);
        onStatus?.(got);
      },
      () => undefined, // the next look
    );
  }, [client, onStatus]);

  const stRef = useRef(st);
  useEffect(() => {
    stRef.current = st;
  }, [st]);
  const loadTree = useCallback((): Promise<void> => {
    const now = stRef.current;
    if (!client || (now?.desired !== 'running' && !now?.session)) return Promise.resolve();
    return client.orchestratorTree().then(
      (got) => {
        if (mounted.current) setTree(got);
      },
      () => undefined, // stopped, or not made yet
    );
  }, [client]);

  const treeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const treeSoon = useCallback(() => {
    if (treeTimer.current) return;
    treeTimer.current = setTimeout(() => {
      treeTimer.current = null;
      loadTree();
    }, 800);
  }, [loadTree]);
  useEffect(
    () => () => {
      if (treeTimer.current) clearTimeout(treeTimer.current);
    },
    [],
  );

  const loadTx = useCallback(
    (sid: string): Promise<void> => {
      if (!client) return Promise.resolve();
      return client.orchestratorSession(sid).then(
        (x) => {
          if (mounted.current) setTxOf({ sid, x });
        },
        () => {
          if (mounted.current) setTxOf({ sid, x: { messages: [], truncated: false, reason: 'unreachable' } });
        },
      );
    },
    [client],
  );

  // The state now and then, the tree more slowly; the clock for the running times.
  useEffect(() => {
    loadStatus().then(() => loadTree());
    const a = setInterval(() => {
      setNow(Date.now());
      loadStatus();
    }, STATUS_EVERY);
    const b = setInterval(() => loadTree(), TREE_EVERY);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [loadStatus, loadTree]);

  useEffect(() => {
    if (running || st?.session) loadTree();
  }, [running, st?.session, loadTree]);

  // The session shown: its transcript read, then kept up by the stream.
  useEffect(() => {
    atBottom.current = true;
    if (shown) loadTx(shown);
  }, [shown, loadTx]);

  const setNode = useCallback((sid: string, state: AgentState | null) => {
    if (!state) return;
    setTree((tr) => (tr ? { ...tr, nodes: tr.nodes.map((n) => (n.id === sid ? { ...n, state } : n)) } : tr));
  }, []);

  /** One event of the stream. */
  const apply = useRef<(e: OrchEvent, again: boolean) => void>(() => undefined);
  const onEvent = (e: OrchEvent, again: boolean) => {
    switch (e.type) {
      case 'hello':
      case 'connected':
        // Opened again: what came in between is read afresh.
        if (again || lost) {
          setLost(false);
          if (shownRef.current) loadTx(shownRef.current);
          loadTree();
        }
        return;
      case 'lost':
        setLost(true);
        return;
      case 'bye':
        if (e.why === 'behind' && shownRef.current) loadTx(shownRef.current);
        return;
      case 'session':
        treeSoon();
        return;
      case 'status':
        if (e.session) setNode(e.session, e.status === 'busy' ? 'running' : e.status === 'retry' ? 'retry' : null);
        treeSoon();
        return;
      case 'error':
        treeSoon();
        loadStatus();
        return;
    }
    if (e.session !== shownRef.current) {
      if (e.type === 'message' || e.type === 'part') treeSoon();
      return;
    }
    if (e.type === 'message' && (e.kind === 'auth' || e.kind === 'credit')) loadStatus();
    if (e.type === 'part' && e.part && typeof e.part === 'object' && e.part.type === 'tool' && e.part.session) treeSoon();
    const sid = shownRef.current;
    // A new message while the reader is further up: offered, not forced.
    if (e.type === 'message' && !atBottom.current && e.id && !txOf?.x.messages.some((m) => m.id === e.id)) setBelow(true);
    setTxOf((now) => (now && now.sid === sid ? { sid, x: applyEvent(now.x, e, sid) } : now));
  };
  useEffect(() => {
    apply.current = onEvent;
  });

  // The stream: open while it runs, opened again after a break (sooner the first times).
  useEffect(() => {
    if (!client || !running) return;
    let stopped = false;
    let ctl: AbortController | null = null;
    let wake: (() => void) | null = null;
    const sleep = (ms: number) =>
      new Promise<void>((done) => {
        const timer = setTimeout(done, ms);
        wake = () => {
          clearTimeout(timer);
          done();
        };
      });
    (async () => {
      let tries = 0;
      let opened = 0;
      while (!stopped) {
        const c = new AbortController();
        ctl = c;
        let recycled = false;
        const recycle = setTimeout(() => {
          recycled = true;
          c.abort();
        }, RECYCLE_MS);
        let failed = false;
        const again = opened > 0;
        opened++;
        try {
          await client.orchestratorEvents({
            signal: c.signal,
            onEvent: (ev) => {
              tries = 0;
              if (!stopped) apply.current(ev, again);
            },
          });
        } catch {
          failed = !recycled;
        }
        clearTimeout(recycle);
        if (stopped) return;
        if (failed) {
          setLost(true);
          await sleep(Math.min(30_000, 1000 * 2 ** Math.min(tries++, 5)));
        } else {
          await sleep(recycled ? 0 : 500);
        }
      }
    })();
    return () => {
      stopped = true;
      ctl?.abort();
      (wake as (() => void) | null)?.();
    };
  }, [client, running]);

  const rows = useMemo(() => treeRows(tree), [tree]);
  const nodeOf = (id: string) => tree?.nodes.find((n) => n.id === id) ?? null;
  const show = (sid: string | null) => setView(sid && sid !== root ? sid : null);
  const sub = view ? nodeOf(view) : null;

  const scrolled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = e.nativeEvent.contentOffset.y < 60;
    atBottom.current = at;
    if (at && below) setBelow(false);
  };
  const toBottom = () => {
    setBelow(false);
    atBottom.current = true;
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };
  /** Ten more of the session's messages, as the reader nears the top. */
  const showOlder = () => {
    if (hidden > 0) setCountOf({ sid: shown, n: count + PAGE });
  };

  const banner = st ? (
    st.halted ? (
      <Banner
        tone="warn"
        title={haltTitle(st.halted.kind, t)}
        text={st.halted.message}
        action={t.fixAndStart}
        onAction={() => setSheet('agent')}
      />
    ) : st.desired !== 'running' ? (
      <Banner tone="quiet" text={t.notRunning} action={t.openSettings} onAction={() => setSheet('agent')} />
    ) : st.crash_loop ? (
      <Banner tone="warn" text={t.crashLoop} />
    ) : lost ? (
      <Banner tone="quiet" text={t.reconnecting} />
    ) : null
  ) : null;

  const treeList = (
    <View testID="orch-tree">
      {rows.length ? (
        rows.map((r) => (
          <NodeRow
            key={r.n.id}
            r={r}
            t={t}
            now={now}
            on={(view ?? root) === r.n.id}
            onPress={() => {
              show(r.depth ? r.n.id : null);
              if (!side) setTreeOpen(false);
            }}
          />
        ))
      ) : (
        <Text style={s.dimPad}>{t.noAgent}</Text>
      )}
    </View>
  );

  const working = busyAgents(rows);

  return (
    <SafeAreaView
      style={s.safe}
      edges={['top', 'left', 'right', 'bottom']}
      testID="orchestrator-screen"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={s.head}>
        {!wide && onMenu ? (
          <IconButton icon={Menu} label="Open the conversations" onPress={onMenu} testID="orch-open-drawer" />
        ) : (
          <View style={s.headPad} />
        )}
        <View style={s.mid}>
          <Text style={s.title} numberOfLines={1} accessibilityRole="header">
            {t.orchestrator}
          </Text>
          {st ? (
            <View style={s.stateLine}>
              <StateDot s={statusDot(st)} />
              <Text style={s.stateText} numberOfLines={1} testID="orch-state">
                {stateWord(st, t)}
                {st.model ? <Text style={s.mono}>{`  ${modelName(st.model)}`}</Text> : null}
              </Text>
            </View>
          ) : null}
        </View>
        {st?.mcp_version ? (
          <Pressable
            onPress={() => setSheet('mcp')}
            accessibilityRole="button"
            accessibilityLabel={t.mcpAbout}
            style={({ pressed }) => [s.ver, pressed && s.pressed]}
            testID="orch-mcp"
            hitSlop={6}
          >
            <Text style={s.verText} numberOfLines={1}>
              MCP {st.mcp_version}
            </Text>
          </Pressable>
        ) : null}
        <IconButton icon={Settings} label={t.agentLlm} onPress={() => setSheet('agent')} testID="orch-settings" />
      </View>
      {banner}
      <View style={s.body}>
        <View style={s.flex}>
          {!side ? (
            <View style={s.fold}>
              <Pressable
                onPress={() => setTreeOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: treeOpen }}
                style={({ pressed }) => [s.foldHead, pressed && s.pressed]}
                testID="orch-tree-toggle"
              >
                <Glyph icon={Network} size={16} color={colors.inkDim} />
                <Text style={s.foldTitle}>{t.agents}</Text>
                <Text style={s.foldMeta} numberOfLines={1}>
                  {working ? t.atWork(working) : rows.length > 1 ? String(rows.length - 1) : ''}
                </Text>
                <Glyph icon={treeOpen ? ChevronDown : ChevronRight} size={16} color={colors.inkDim} />
              </Pressable>
              {treeOpen ? (
                <ScrollView style={s.foldBody} nestedScrollEnabled indicatorStyle="white">
                  {treeList}
                </ScrollView>
              ) : null}
            </View>
          ) : null}
          {sub || view ? (
            <View style={s.subBar}>
              <Pressable
                onPress={() => show(null)}
                accessibilityRole="button"
                accessibilityLabel={t.back}
                style={({ pressed }) => [s.subBack, pressed && s.pressed]}
                testID="orch-sub-back"
                hitSlop={6}
              >
                <Glyph icon={ChevronLeft} size={16} color={colors.inkDim} />
                <Text style={s.link}>{t.orchestrator}</Text>
              </Pressable>
              <Text style={s.subTitle} numberOfLines={1}>
                {sub?.title || sub?.agent || tx?.title || ''}
              </Text>
              {sub?.agent ? <Text style={s.tag}>{sub.agent}</Text> : null}
            </View>
          ) : null}
          {tx && (tx.messages.length || tx.reason) ? (
            <FlatList
              ref={list}
              inverted
              indicatorStyle="white"
              testID="orch-list"
              data={drawn}
              keyExtractor={(m, i) => m.id || String(i)}
              renderItem={({ item }) => <MsgView m={item} sub={!!view} t={t} lang={lang} onOpen={show} />}
              onScroll={scrolled}
              scrollEventThrottle={64}
              onEndReached={showOlder}
              onEndReachedThreshold={0.3}
              maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
              contentContainerStyle={s.pad}
              // Upside down: the footer is the top (more to come, or why it stops there), the header the bottom.
              ListFooterComponent={
                hidden ? (
                  <ActivityIndicator style={s.older} color={colors.inkDim} testID="orch-older" />
                ) : (
                  <>
                    {tx.reason ? <Text style={s.none}>{reasonText(tx.reason, t)}</Text> : null}
                    {tx.truncated ? <Text style={s.none}>{t.onlyLatest}</Text> : null}
                  </>
                )
              }
              ListHeaderComponent={<Text style={s.ro}>{t.readOnly}</Text>}
            />
          ) : tx ? (
            <View style={s.pad}>
              <Text style={s.none}>{t.nothingYet}</Text>
              <Text style={s.ro}>{t.readOnly}</Text>
            </View>
          ) : running && shown ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.inkDim} />
            </View>
          ) : (
            <View style={s.pad}>
              {st && running ? <Text style={s.none}>{t.nothingYet}</Text> : null}
              <Text style={s.ro}>{t.readOnly}</Text>
            </View>
          )}
          {below ? <NewBelow label={t.newBelow} onPress={toBottom} bottom={16} /> : null}
        </View>
        {side ? (
          <View style={s.side}>
            <ScrollView style={s.flex} indicatorStyle="white">
              <Text style={s.sideHead}>{t.agents}</Text>
              {treeList}
            </ScrollView>
          </View>
        ) : null}
      </View>
      {sheet === 'mcp' ? <McpSheet client={client} t={t} onClose={() => setSheet(null)} /> : null}
      {sheet === 'agent' ? (
        <AgentSheet
          client={client}
          t={t}
          lang={lang}
          onClose={() => setSheet(null)}
          onChanged={(s2) => {
            setSt((was) => ({ ...s2, mcp_version: s2.mcp_version ?? was?.mcp_version }));
            onStatus?.(s2);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
});

function Banner({
  tone,
  title,
  text,
  action,
  onAction,
}: {
  tone: 'warn' | 'quiet';
  title?: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Appear fill={false} duration={motion.fade}>
      <View style={[s.banner, tone === 'quiet' && s.bannerQuiet]} accessibilityRole={tone === 'warn' ? 'alert' : undefined} testID="orch-banner">
        <Text style={[s.bannerText, tone === 'quiet' && s.bannerQuietText]}>
          {title ? <Text style={s.bold}>{`${title}  `}</Text> : null}
          {text}
        </Text>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            style={({ pressed }) => [s.bannerBtn, pressed && s.pressed]}
            testID="orch-banner-action"
          >
            <Text style={s.bannerBtnText}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
    </Appear>
  );
}

function NodeRow({ r, t, now, on, onPress }: { r: TreeRow; t: OrchStrings; now: number; on: boolean; onPress: () => void }) {
  const n = r.n;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [s.node, { paddingLeft: gutter + r.depth * 14 }, pressed && s.pressed]}
      testID={`orch-node-${n.id}`}
    >
      <View style={s.nodeTop}>
        <StateDot s={n.state === 'running' ? 'running' : n.state === 'retry' ? 'retry' : n.state === 'error' ? 'error' : n.state === 'stopped' ? 'stopped' : 'done'} />
        <Text style={[s.nodeName, on && s.on]} numberOfLines={1}>
          {r.depth ? n.title || n.agent : t.orchestrator}
        </Text>
        {n.agent && r.depth ? <Text style={s.tag}>{n.agent}</Text> : null}
        <Text style={s.dim}>{nodeTime(n, now)}</Text>
      </View>
      <Text style={s.nodeStep} numberOfLines={1}>
        {stepText(n, t)}
      </Text>
    </Pressable>
  );
}

const MsgView = memo(function MsgView({
  m,
  sub,
  t,
  lang,
  onOpen,
}: {
  m: OrchMessage;
  sub: boolean;
  t: OrchStrings;
  lang: 'en' | 'tr';
  onOpen: (sid: string) => void;
}) {
  return (
    <View style={s.msg} testID={`orch-msg-${m.id}`}>
      <View style={s.who}>
        <Text style={[s.whoName, m.role === 'user' && s.whoUser]}>{author(m, sub, t)}</Text>
        {m.time ? <Text style={s.dim}>{clockOf(m.time, lang)}</Text> : null}
      </View>
      {m.parts.map((p, i) => (
        <PartView key={p.id ?? `i${i}`} m={m} p={p} t={t} onOpen={onOpen} />
      ))}
      {m.error ? <Text style={s.err}>{m.error}</Text> : null}
    </View>
  );
});

function PartView({ m, p, t, onOpen }: { m: OrchMessage; p: OrchPart; t: OrchStrings; onOpen: (sid: string) => void }) {
  if (p.type === 'text') {
    if (m.role === 'user') return <UserText text={p.text ?? ''} />;
    return p.synthetic ? <Text style={s.synthetic}>{p.text}</Text> : <Markdown text={p.text ?? ''} />;
  }
  if (p.type === 'reasoning') return <Thought text={p.text ?? ''} live={isLive(m, p)} t={t} />;
  if (p.type === 'tool') {
    const sd = said(p, t);
    if (sd)
      return (
        <View style={s.said} testID="orch-said">
          <Text style={s.saidRoom}>
            {t.answeredIn} {sd.room}
          </Text>
          <Text style={[s.saidText, wrapAnywhere]}>{sd.text}</Text>
        </View>
      );
    return <ToolRow p={p} t={t} onOpen={onOpen} />;
  }
  return (
    <Text style={s.note}>
      {p.agent ? `${p.agent}: ` : ''}
      {p.text}
    </Text>
  );
}

/** What Workbench handed it (a line from a room, a note): dim, in a box, folded when long. */
function UserText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 600 || text.split('\n').length > 10;
  return (
    <Pressable onPress={() => long && setOpen((v) => !v)} disabled={!long} accessibilityRole={long ? 'button' : undefined}>
      <Text style={[s.inBox, wrapAnywhere]} numberOfLines={long && !open ? 10 : undefined}>
        {text}
      </Text>
    </Pressable>
  );
}

function Thought({ text, live, t }: { text: string; live: boolean; t: OrchStrings }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? live;
  return (
    <Pressable
      onPress={() => setOpen(!shown)}
      accessibilityRole="button"
      accessibilityState={{ expanded: shown }}
      style={s.think}
    >
      <View style={s.rowLine}>
        <Glyph icon={shown ? ChevronDown : ChevronRight} size={14} color={colors.inkDim} />
        <Text style={s.dimSmall}>{t.thinkingTitle}</Text>
      </View>
      {shown ? <Text style={s.thinkText}>{text}</Text> : null}
    </Pressable>
  );
}

function ToolRow({ p, t, onOpen }: { p: OrchPart; t: OrchStrings; onOpen: (sid: string) => void }) {
  const [open, setOpen] = useState(false);
  const has = !!(p.input || p.output || p.error);
  return (
    <View style={s.tool}>
      <Pressable
        onPress={() => has && setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [s.toolHead, pressed && has && s.pressed]}
        testID="orch-tool"
      >
        <StateDot s={toolState(p.status)} />
        <Text style={s.toolName} numberOfLines={1}>
          {toolName(p, t)}
        </Text>
        <Text style={s.toolArgs} numberOfLines={1}>
          {toolArgs(p)}
        </Text>
        {p.start && p.end ? <Text style={s.dim}>{span(p.start, p.end)}</Text> : null}
        {p.session ? (
          <Pressable onPress={() => onOpen(p.session!)} accessibilityRole="button" hitSlop={8} testID="orch-tool-open">
            <Text style={s.link}>{t.open}</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {open ? (
        <View style={s.toolBody}>
          {p.input ? <Pre label={t.input} text={p.input} /> : null}
          {p.output ? <Pre label={t.output} text={p.output} /> : null}
          {p.error ? <Pre label={t.failed} text={p.error} danger /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Pre({ label, text, danger }: { label: string; text: string; danger?: boolean }) {
  return (
    <View style={s.preWrap}>
      <Text style={s.preLabel}>{label}</Text>
      <ScrollView style={s.preScroll} nestedScrollEnabled indicatorStyle="white">
        <Text style={[s.pre, danger && s.preDanger, wrapAnywhere]} selectable>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  head: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headPad: { width: space.sm },
  mid: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  stateText: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.ink },
  mono: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkDim },
  ver: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 8, borderRadius: radius.sm },
  verText: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkDim },
  pressed: { backgroundColor: colors.hover },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  banner: {
    marginHorizontal: gutter - 4,
    marginTop: space.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.warnSoft,
    gap: 8,
  },
  bannerQuiet: { backgroundColor: colors.hover },
  bannerText: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 19, color: colors.warn },
  bannerQuietText: { color: colors.inkDim },
  bold: { fontFamily: fonts.sansSemi },
  bannerBtn: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.pressed,
  },
  bannerBtnText: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.ink },
  fold: { borderBottomWidth: 1, borderBottomColor: colors.line },
  foldHead: { minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: gutter },
  foldTitle: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.ink },
  foldMeta: { flex: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  foldBody: { maxHeight: 280, paddingBottom: space.xs },
  side: { width: 300, flexGrow: 0, flexShrink: 0, borderLeftWidth: 1, borderLeftColor: colors.line, paddingTop: space.sm },
  sideHead: {
    paddingHorizontal: gutter,
    paddingBottom: 6,
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.inkDim,
    textTransform: 'uppercase',
  },
  dimPad: { paddingHorizontal: gutter, paddingVertical: space.xs, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  node: { minHeight: touch, justifyContent: 'center', paddingRight: gutter, paddingVertical: 6 },
  nodeTop: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  nodeName: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  nodeStep: { marginLeft: 13, marginTop: 2, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  tag: {
    overflow: 'hidden',
    paddingHorizontal: 5,
    borderRadius: 4,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkDim,
    backgroundColor: colors.hover,
  },
  dim: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  dimSmall: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: space.sm,
    paddingRight: gutter,
    minHeight: touch,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  subBack: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36, paddingHorizontal: 6, borderRadius: radius.sm },
  subTitle: { flex: 1, minWidth: 0, fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.ink },
  link: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, textDecorationLine: 'underline' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  older: { paddingVertical: space.md },
  pad: { paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.lg, flexGrow: 1 },
  none: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 19, color: colors.inkDim, paddingVertical: space.sm },
  ro: {
    marginTop: space.lg,
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    color: colors.inkDim,
    textAlign: 'center',
  },
  msg: { paddingTop: 6, paddingBottom: 10, gap: 4 },
  who: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  whoName: { fontFamily: fonts.sansSemi, fontSize: type.tiny, color: colors.ink },
  whoUser: { color: colors.inkDim },
  inBox: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.hover,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: 19,
    color: colors.inkDim,
  },
  synthetic: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 20, color: colors.inkDim },
  think: { paddingVertical: 2 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  thinkText: { paddingLeft: 20, fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 18, color: colors.inkDim },
  said: { gap: 2, paddingVertical: 4 },
  saidRoom: { fontFamily: fonts.sansSemi, fontSize: type.tiny, color: colors.inkDim },
  saidText: { fontFamily: fonts.sans, fontSize: type.body - 1, lineHeight: 22, color: colors.ink },
  tool: { marginVertical: 1 },
  toolHead: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm },
  toolName: { flexShrink: 0, maxWidth: '45%', fontFamily: fonts.sansSemi, fontSize: type.tiny, color: colors.ink },
  toolArgs: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  toolBody: { paddingLeft: 15, gap: 6, paddingBottom: 4 },
  preWrap: { gap: 2 },
  preLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },
  preScroll: { maxHeight: 240, borderRadius: radius.md, backgroundColor: colors.hover },
  pre: { padding: 8, fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.inkDim },
  preDanger: { color: colors.danger },
  note: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  err: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.danger },
});
