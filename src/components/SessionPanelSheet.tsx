/**
 * Mount it to open it. One OpenCode session's column, as the web app's right-hand column draws it
 * (rooms/session-panel.ts; backend/wb_panel.py): what it is waiting for, its todo list, the files it changed,
 * the model and its window, the computer it runs on and the tools it used - in that order, the things that
 * need a person first.
 *
 * The same rules as the web: a section with nothing in it is not drawn, a section's fold is the person's (kept
 * on the server, /api/me/side `panel`, so it is the same on the phone and in the browser), a file or a tool row
 * scrolls the conversation to the call it happened in, and a permission is answered from here (once / always /
 * reject) - a question's own form is answered in the conversation, where the fields are. The head's number sits
 * at the same place on every row, and a folded tools head says which tools did the work rather than how many
 * calls there were.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { PanelFile, PanelTool, WboAsk, WboPanel } from '../api/types';
import {
  baseName,
  ctxLine,
  ctxTip,
  ctxTone,
  dirName,
  TOOLS_SHOWN,
  fileLine,
  kfmt,
  panelSections,
  stateWord,
  toolLine,
  waitingLine,
  workedFor,
  type PanelSectionId,
} from '../lib/wboPanel';
import { ContextChart, DiffSpark, FlowStrip } from './PanelCharts';
import type { WboStrings } from '../lib/wboStrings';
import { copy as copyToClipboard } from '../lib/feel';
import { colors, fonts, gutter, radius, space, touch, type } from '../theme/tokens';
import { TallSheet } from './TallSheet';
import { Activity, Check, ChevronDown, ChevronRight, Square, X } from './icons';
import { Button, ErrorText, Glyph } from './ui';

const REFRESH_MS = 5_000;

export function SessionPanelSheet({
  client,
  sid,
  t,
  onClose,
  onJump,
  onAnswer,
  onModel,
  when,
}: {
  client: WorkbenchClient | null;
  sid: string;
  t: WboStrings;
  onClose: () => void;
  /** A row was tapped: the conversation goes to what it is about (a message id). */
  onJump: (message: string) => void;
  /** A permission answered here; the caller sends it and refreshes. */
  onAnswer: (a: WboAsk, decision: 'once' | 'always' | 'reject') => void;
  /** The model's row was tapped: the composer's own picker, the one the app already has. */
  onModel: () => void;
  /** "12 min ago" for a row's own time, in the page's language. */
  when: (at: number | null) => string;
}) {
  const [panel, setPanel] = useState<WboPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  const [allFiles, setAllFiles] = useState(false);
  const [allTools, setAllTools] = useState(false);
  /** The strip's range: the last quarter of an hour, unless the person asked for more. */
  const [range, setRange] = useState<'15m' | '1h' | 'all'>('15m');
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPanel(null);
    setError(null);
    setAllFiles(false);
    if (client) {
      client
        .side()
        .then((p) => setFolds(p.panel ?? {}))
        .catch(() => undefined);
    }
  }, [client, sid]);

  // One answer, read again while the sheet is open: it is a moment of the session, and the session moves.
  useEffect(() => {
    if (!client) return;
    let live = true;
    const read = () =>
      client.wboPanel(sid).then(
        (got) => {
          if (!live) return;
          setPanel(got);
          setError(null);
          setNow(Date.now());
        },
        (e) => live && setError(e instanceof ApiError ? e.message : t.columnFailed),
      );
    void read();
    const timer = setInterval(() => void read(), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [client, sid, t]);

  const flip = (id: PanelSectionId) => {
    const open = folds[id] !== false;
    setFolds((f) => ({ ...f, [id]: !open }));
    client?.sidePanel(id, !open).catch(() => undefined);
  };
  const isOpen = (id: PanelSectionId) => folds[id] !== false;

  // the state, once: under the sheet's own title, where the web's column head keeps it
  const state = panel
    ? panel.session.status === 'busy'
      ? `${t.working} ${workedFor(panel.session.since, now)}`
      : stateWord(panel, t)
    : '';
  const sub = [panel?.session.title || t.session, state].filter(Boolean).join(' · ');
  const sections = panelSections(panel, t);
  const mayAnswer = panel?.may_answer === true;
  const copy = (v: string) => {
    void copyToClipboard(v);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    return v;
  };

  return (
    <TallSheet
      title={t.columnTitle}
      sub={sub}
      closeLabel={t.close}
      onClose={onClose}
      testID="wbo-panel"
    >
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!panel && !error ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.inkDim} accessibilityLabel={t.readingColumn} />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={s.scroll} testID="wbo-panel-scroll">
        <SafeAreaView edges={['left', 'right']} style={s.wrap}>
          {panel?.pending?.length ? (
            <Pressable
              onPress={() => onJump(panel.pending[0].message ?? '')}
              accessibilityRole="button"
              accessibilityHint={t.stoppedUntilAnswered}
              style={s.wait}
              testID="wbo-panel-waiting"
            >
              <View style={[s.waitDot, { backgroundColor: colors.warn }]} />
              <Text style={s.waitText} numberOfLines={1}>
                {waitingLine(panel, t)}
              </Text>
              <Text style={s.dim} numberOfLines={1}>
                {t.answerInConversation}
              </Text>
            </Pressable>
          ) : null}
          {sections.map((sec) => (
            <View key={sec.id} style={s.sec}>
              <Pressable
                onPress={() => flip(sec.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen(sec.id) }}
                style={s.head}
                testID={`wbo-sec-${sec.id}`}
              >
                <Glyph icon={isOpen(sec.id) ? ChevronDown : ChevronRight} size={13} color={colors.inkDim} />
                <Text style={[s.headText, sec.warn ? s.warn : null]} numberOfLines={1}>
                  {sec.label}
                </Text>
                {sec.id === 'files' ? <DiffSpark points={panel?.series?.diff_series ?? []} /> : null}
                {sec.count ? (
                  <Text style={[s.count, sec.warn ? s.warn : null]} numberOfLines={1} testID={`wbo-count-${sec.id}`}>
                    {sec.count}
                  </Text>
                ) : null}
              </Pressable>
              {isOpen(sec.id) && panel ? (
                <View style={s.body}>
                  {sec.id === 'model' ? (
                    <ModelBody panel={panel} t={t} now={now} onModel={onModel} copied={copied} />
                  ) : null}
                  {sec.id === 'flow' ? (
                    <FlowBody
                      panel={panel}
                      t={t}
                      now={now}
                      range={range}
                      onRange={setRange}
                      onJump={onJump}
                      all={allTools}
                      onMore={() => setAllTools(true)}
                    />
                  ) : null}
                  {sec.id === 'files' ? (
                    <FilesBody
                      panel={panel}
                      t={t}
                      when={when}
                      all={allFiles}
                      onAll={() => setAllFiles(true)}
                      onJump={onJump}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
          {panel?.session ? <FootLine panel={panel} t={t} onCopy={copy} copied={copied} /> : null}
        </SafeAreaView>
      </ScrollView>
    </TallSheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvKey} numberOfLines={1}>
        {k}
      </Text>
      <Text style={s.kvVal} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

function ModelBody({
  panel,
  t,
  now,
  onModel,
  copied,
}: {
  panel: WboPanel;
  t: WboStrings;
  now: number;
  onModel: () => void;
  copied: boolean;
}) {
  void copied;
  const m = panel.session.model;
  const c = panel.session.context;
  const pct = c?.pct ?? null;
  const sub = [m?.providerName || m?.providerID || '', m?.variant ? t.thinkingLevel(m.variant) : '']
    .filter(Boolean)
    .join(' · ');
  const tone = ctxTone(panel);
  return (
    <View>
      <Pressable onPress={onModel} accessibilityRole="button" accessibilityHint={t.pickModel} testID="wbo-panel-modelrow">
        <Text style={s.model} numberOfLines={2} testID="wbo-panel-model">
          {m?.name || m?.modelID || t.model}
        </Text>
        {sub ? (
          <Text style={s.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </Pressable>
      {c ? (
        <View style={s.ctxWrap} accessible accessibilityLabel={ctxTip(panel, t)} testID="wbo-panel-context">
          <Text style={[s.ctx, tone === 'warn' ? s.warn : tone === 'bad' ? s.bad : null]} numberOfLines={1}>
            {ctxLine(panel)}
          </Text>
          <View style={s.bar}>
            <View
              style={[s.barFill, tone === 'warn' ? s.barWarn : tone === 'bad' ? s.barBad : null, { width: `${pct ?? 0}%` }]}
            />
          </View>
        </View>
      ) : null}
      {/* the window over the turns: the line says when this session is to be left */}
      <ContextChart points={panel.series?.context ?? []} limit={c?.limit ?? 0} tone={tone} testID="wbo-panel-ctxchart" />
      {estimate(panel, t) ? <Text style={s.dim}>{estimate(panel, t)}</Text> : null}
      {/* one line of spending: what it cost and what it moved, the caches above it when opened */}
      <Text style={s.spend} numberOfLines={1}>
        {`${panel.tokens.cost != null ? `$${panel.tokens.cost.toFixed(2)}` : '–'} · ${kfmt(panel.tokens.input)} ${t.inTok} · ${kfmt(panel.tokens.output)} ${t.outTok}`}
      </Text>
      <View style={s.grid}>
        <Row k={t.input} v={kfmt(panel.tokens.input)} />
        <Row k={t.output} v={kfmt(panel.tokens.output)} />
        {panel.tokens.cache_read != null ? <Row k={t.cacheRead} v={kfmt(panel.tokens.cache_read)} /> : null}
        {panel.tokens.cache_write != null ? <Row k={t.cacheWrite} v={panel.tokens.cache_write ? kfmt(panel.tokens.cache_write) : '—'} /> : null}
      </View>
      {panel.tokens.source === 'messages' ? <Text style={s.dim}>{t.lastMessages(panel.tokens.messages)}</Text> : null}
    </View>
  );
}

/**
 * What the run is doing now: one line (the call and how long it has been on it, or the last thing it did), the
 * strip of the last quarter of an hour, the output-token rate under it, the todo list's bar and the tools'
 * share - the same three things the web's column has, in the same order.
 */
function FlowBody({
  panel,
  t,
  now,
  range,
  onRange,
  onJump,
  all,
  onMore,
}: {
  panel: WboPanel;
  t: WboStrings;
  now: number;
  range: '15m' | '1h' | 'all';
  onRange: (id: '15m' | '1h' | 'all') => void;
  onJump: (message: string) => void;
  all: boolean;
  onMore: () => void;
}) {
  const spans = panel.series?.spans ?? [];
  const working = panel.session.status === 'busy' || panel.session.status === 'retry';
  // a call that does work says what the run is on: a todo list written is bookkeeping
  const work = spans.filter((x) => x.cat !== 'other');
  const last = (work.length ? work : spans)[(work.length ? work : spans).length - 1];
  const rows = panel.tools?.items ?? [];
  const total = rows.reduce((n, r) => n + r.count, 0);
  const [open, setOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const todos = panel.todos;
  const current =
    todos?.items.find((r) => r.status === 'in_progress')?.content ?? todos?.items.find((r) => r.status === 'pending')?.content ?? '';
  return (
    <View>
      {last ? (
        <Text style={s.nowLine} numberOfLines={1} testID="wbo-panel-now">
          <Text style={s.nowKey}>{working ? t.now : t.last}</Text>
          {` ${last.server ? `${last.server} · ${last.tool}` : last.tool || catWord(last.cat, t)}${last.title ? ` · ${last.title}` : ''}`}
        </Text>
      ) : null}
      <FlowStrip
        series={panel.series}
        now={now}
        working={working}
        range={range}
        onRange={onRange}
        onJump={onJump}
        stall={stallNote(panel, t, now)}
        testID="wbo-panel-strip"
      />
      {todos ? (
        <Pressable onPress={() => setTodoOpen(!todoOpen)} accessibilityRole="button" style={s.todosLine}
                   accessibilityState={{ expanded: todoOpen }} testID="wbo-panel-todos">
          <View style={s.todoBar}>
            <View style={[s.todoBarFill, { width: `${todos.total ? (todos.done * 100) / todos.total : 0}%` }]} />
          </View>
          <Text style={s.dim}>{`${todos.done}/${todos.total}`}</Text>
          {current ? (
            <Text style={s.rowText} numberOfLines={1}>
              {current}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
      {todoOpen ? <TodosBody panel={panel} /> : null}
      {rows.length ? (
        <>
          <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}
                     testID="wbo-panel-tools">
            <Text style={s.link}>{open ? t.hideTools : t.whichTools}</Text>
          </Pressable>
          {open
            ? (all ? rows : rows.slice(0, TOOLS_SHOWN)).map((r) => (
                <Pressable key={`${r.server}:${r.name}`} onPress={() => onJump(r.message)} accessibilityRole="button"
                           style={s.row} testID="wbo-panel-tool">
                  <Text style={s.rowText} numberOfLines={1}>
                    {r.server ? `${r.server} · ${r.name}` : r.name}
                  </Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {toolLine(r, t)}
                  </Text>
                </Pressable>
              ))
            : null}
          {open && rows.length > TOOLS_SHOWN && !all ? (
            <Pressable onPress={onMore} accessibilityRole="button">
              <Text style={s.link}>{t.moreTools(rows.length - TOOLS_SHOWN)}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {!open && total ? (
        <Text style={s.dim} numberOfLines={1}>{`${total} ${t.tools.toLowerCase()}`}</Text>
      ) : null}
    </View>
  );
}

/** A category in the person's words: what the run is writing when it has called nothing. */
function catWord(cat: string, t: WboStrings): string {
  switch (cat) {
    case 'read': return t.reading;
    case 'edit': return t.editing;
    case 'shell': return t.shellCat;
    case 'web': return t.webCat;
    case 'subagent': return t.subAgent;
    case 'mcp': return 'MCP';
    case 'text': return t.writingCat;
    default: return t.otherCat;
  }
}

/** "at this pace, compaction in ~6 turns" - from the last few turns, and only when they grew. */
function estimate(panel: WboPanel, t: WboStrings): string {
  const rows = (panel.series?.context ?? []).filter((p) => p.used > 0);
  const limit = rows[rows.length - 1]?.limit ?? 0;
  if (!limit || rows.length < 3) return '';
  const last = rows.slice(-5);
  const steps: number[] = [];
  for (let i = 1; i < last.length; i++) steps.push(last[i].used - last[i - 1].used);
  const grew = steps.filter((x) => x > 0);
  if (!grew.length) return '';
  const pace = grew.reduce((a, b) => a + b, 0) / grew.length;
  const turns = Math.round((limit - rows[rows.length - 1].used) / pace);
  return turns > 0 && turns < 10_000 ? t.compactionTurns(turns) : '';
}

/** Working, and nothing new for a couple of minutes: said, because a flat rate is easy to miss. */
function stallNote(panel: WboPanel, t: WboStrings, now: number): string {
  const working = panel.session.status === 'busy' || panel.session.status === 'retry';
  if (!working) return '';
  const spans = panel.series?.spans ?? [];
  const lastCall = spans.reduce((p, x) => Math.max(p, x.end), 0);
  const rate = panel.series?.rate;
  const lastTokens = rate?.items.reduce((p, b) => Math.max(p, b.at + rate.step), 0) ?? 0;
  const last = Math.max(lastCall, lastTokens, panel.session.since ?? 0);
  const quiet = now - last;
  if (!last || quiet < 120_000) return '';
  return t.nothingNew(Math.round(quiet / 60_000));
}

/**
 * The foot, in one dim line: the computer, the wb-opencode on it, the directory the session runs in and its MCP
 * servers. Its own details - the platform, the OpenCode version, the full path, each server by name, the device
 * key - are the sheet's older Computer section, and they are here, not repeated above.
 */
function FootLine({
  panel,
  t,
  onCopy,
  copied,
}: {
  panel: WboPanel;
  t: WboStrings;
  onCopy: (v: string) => string;
  copied: boolean;
}) {
  const c = panel.session.computer;
  const [open, setOpen] = useState(false);
  if (!c) return null;
  const mcp = c.mcp ?? [];
  const ok = mcp.filter((m) => m.status === 'connected').length;
  const mcpText = Array.isArray(c.mcp) ? (mcp.length ? `MCP ${ok}/${mcp.length}` : t.mcpNone) : '';
  const dir = shortDir(panel.session.directory || '');
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}
                 style={s.foot} testID="wbo-panel-foot">
        <View style={[s.footDot, { backgroundColor: c.connected ? colors.ok : colors.inkDim }]} />
        <Text style={s.footText} numberOfLines={1}>
          {`${c.host || c.name || 'OpenCode'} · wb-opencode ${c.version || '?'} · ${dir || '—'}${mcpText ? ` · ${mcpText}` : ''}`}
        </Text>
      </Pressable>
      {open ? (
        <View testID="wbo-panel-footmore">
          <Text style={s.dim} numberOfLines={1}>{`${c.platform || ''} · OpenCode ${c.opencode || '?'}`}</Text>
          {c.outdated && !c.self_updates ? <Text style={s.warn}>{t.updateWboLong}</Text> : null}
          {c.cwd ? (
            <Pressable onPress={() => onCopy(c.cwd)} accessibilityRole="button" accessibilityHint={t.copy}
                       testID="wbo-panel-cwd">
              <Text style={s.cwd} numberOfLines={2}>
                {c.cwd}
              </Text>
              <Text style={s.dim} numberOfLines={1}>
                {copied ? t.copied : t.copy}
              </Text>
            </Pressable>
          ) : null}
          {mcp.length
            ? mcp.map((srv) => (
                <Text key={srv.name} style={s.dim} numberOfLines={1}>
                  {`MCP · ${srv.name} · ${srv.status || '?'}`}
                </Text>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

/** The directory as the foot has room for it: its last two segments, the whole path under the line. */
function shortDir(path: string): string {
  const one = (path || '').replace(/\/+$/, '');
  if (!one || one === '~') return one;
  const parts = one.split('/').filter(Boolean);
  return parts.length <= 2 ? one : `…/${parts.slice(-2).join('/')}`;
}

function ComputerBody({
  panel,
  t,
  onCopy,
  copied,
}: {
  panel: WboPanel;
  t: WboStrings;
  onCopy: (v: string) => string;
  copied: boolean;
}) {
  const c = panel.session.computer;
  if (!c) return null;
  return (
    <View>
      <Text style={s.model} numberOfLines={1}>
        {c.host || c.name || t.opencode}
        <Text style={s.dim}>{` · ${c.connected ? t.connectedShort : t.notConnectedShort}`}</Text>
      </Text>
      {/* the device key's name is not a line of its own any more: it is in Settings > OpenCode */}
      <Text style={s.dim} numberOfLines={1}>
        {`wb-opencode ${c.version || '?'}`}
      </Text>
      {c.outdated && !c.self_updates ? <Text style={s.warn}>{t.updateWboLong}</Text> : null}
      {c.cwd ? (
        <Pressable onPress={() => onCopy(c.cwd)} accessibilityRole="button" accessibilityHint={t.copy} testID="wbo-panel-cwd">
          <Text style={s.cwd} numberOfLines={2}>
            {c.cwd}
          </Text>
          <Text style={s.dim} numberOfLines={1}>
            {copied ? t.copied : t.copy}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const TODO_ICON = { pending: Square, in_progress: Activity, completed: Check, cancelled: X } as const;

function TodosBody({ panel }: { panel: WboPanel }) {
  const rows = panel.todos?.items ?? [];
  return (
    <View>
      {rows.map((r, i) => {
        const done = r.status === 'completed' || r.status === 'cancelled';
        return (
          <View key={`${i}:${r.content.slice(0, 12)}`} style={s.todo} testID="wbo-panel-todo">
            <Glyph
              icon={TODO_ICON[r.status] ?? Square}
              size={13}
              color={r.status === 'in_progress' ? colors.accent : r.status === 'completed' ? colors.ok : colors.inkDim}
            />
            <Text style={[s.todoText, done ? s.todoDone : null]} numberOfLines={3}>
              {r.content}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function FilesBody({
  panel,
  t,
  when,
  all,
  onAll,
  onJump,
}: {
  panel: WboPanel;
  t: WboStrings;
  when: (at: number | null) => string;
  all: boolean;
  onAll: () => void;
  onJump: (message: string) => void;
}) {
  const everything: PanelFile[] = panel.files?.items ?? [];
  const temp = panel.files?.temp?.items ?? [];
  const rows = everything;
  let lastWhen = '';
  return (
    <View>
      {rows.map((f) => {
        const at = when(f.at);
        const showAt = at && at !== lastWhen ? at : '';
        lastWhen = at || lastWhen;
        return (
          <Pressable
            key={f.path}
            onPress={() => onJump(f.message)}
            accessibilityRole="button"
            accessibilityHint={t.showInConversation}
            style={s.row}
            testID="wbo-panel-file"
          >
            <View style={s.filecol}>
              <Text style={s.rowText} numberOfLines={1}>
                {baseName(f.path)}
                {f.additions != null ? (
                  <Text style={s.diff}>{`  +${f.additions} −${f.deletions}`}</Text>
                ) : null}
                {f.outside ? <Text style={s.out}>{'  ↗'}</Text> : null}
              </Text>
              {dirName(f.path) ? (
                <Text style={s.dir} numberOfLines={1} ellipsizeMode="head">
                  {dirName(f.path)}
                </Text>
              ) : null}
            </View>
            <Text style={s.rowMeta} numberOfLines={1}>
              {fileLine(f, showAt, t)}
            </Text>
            {f.error ? <Text style={s.warn}>⚠</Text> : null}
          </Pressable>
        );
      })}
      {temp.length ? (
        <>
          <Pressable onPress={onAll} accessibilityRole="button" testID="wbo-panel-tempfiles"
                     accessibilityState={{ expanded: all }}>
            <Text style={s.link}>{`${all ? '▾' : '▸'} ${t.tempFiles} · ${temp.length}`}</Text>
          </Pressable>
          {all
            ? temp.map((f) => (
                <Pressable key={f.path} onPress={() => onJump(f.message)} accessibilityRole="button"
                           style={[s.row, s.tempRow]} testID="wbo-panel-tempfile">
                  <Text style={s.rowText} numberOfLines={1}>
                    {baseName(f.path)}
                    {f.additions != null ? <Text style={s.diff}>{`  +${f.additions} −${f.deletions}`}</Text> : null}
                  </Text>
                </Pressable>
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

function PendingBody({
  panel,
  t,
  mayAnswer,
  onAnswer,
  onJump,
}: {
  panel: WboPanel;
  t: WboStrings;
  mayAnswer: boolean;
  onAnswer: (a: WboAsk, decision: 'once' | 'always' | 'reject') => void;
  onJump: (message: string) => void;
}) {
  return (
    <View>
      {panel.pending.map((a) => (
        <View key={a.id} style={s.ask} testID="wbo-panel-ask">
          <Text style={s.askHead} numberOfLines={2}>
            {a.kind === 'permission' ? t.asksToRun(a.action || '') : a.title || t.asks}
          </Text>
          {a.kind === 'permission' ? (
            <>
              {(a.resources ?? []).slice(0, 2).map((r, i) => (
                <Text key={`${a.id}:${i}`} style={s.res} numberOfLines={2}>
                  {r}
                </Text>
              ))}
              {a.cut ? <Text style={s.warn}>{t.answerItOnComputer}</Text> : null}
              <View style={s.acts}>
                <Button label={t.allowOnce} onPress={() => onAnswer(a, 'once')} disabled={!mayAnswer || a.cut} />
                <Button label={t.alwaysAllow} onPress={() => onAnswer(a, 'always')} disabled={!mayAnswer || a.cut} />
                <Button label={t.reject} onPress={() => onAnswer(a, 'reject')} disabled={!mayAnswer || a.cut} />
              </View>
            </>
          ) : (
            <Text style={s.dim}>{t.answerOnComputer}</Text>
          )}
          {a.message ? (
            <Pressable onPress={() => onJump(a.message!)} accessibilityRole="button" style={s.jump}>
              <Text style={s.link}>{t.showInConversation}</Text>
            </Pressable>
          ) : null}
          {!mayAnswer ? <Text style={s.dim}>{t.onlyOwnerAnswers}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function ToolsBody({
  panel,
  t,
  onJump,
  all,
  onMore,
}: {
  panel: WboPanel;
  t: WboStrings;
  onJump: (message: string) => void;
  all: boolean;
  onMore: () => void;
}) {
  const everything: PanelTool[] = panel.tools?.items ?? [];
  const rows = all ? everything : everything.slice(0, TOOLS_SHOWN);
  const total = everything.reduce((n, r) => n + r.count, 0);
  return (
    <View>
      {rows.map((r) => (
        <Pressable
          key={`${r.server}:${r.name}`}
          onPress={() => onJump(r.message)}
          accessibilityRole="button"
          accessibilityHint={t.showInConversation}
          style={s.row}
          accessibilityLabel={toolLine(r, t)}
          testID="wbo-panel-tool"
        >
          {/* how much of the session's calls this tool was: a thin bar behind the row, not a box beside it */}
          <View style={[s.ratio, { width: `${total ? Math.max(2, Math.round((r.count / total) * 100)) : 0}%` }]} />
          <Text style={[s.rowText, s.toolName]} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[s.rowMeta, r.errors ? s.warn : null]} numberOfLines={1}>
            {r.errors ? `⚠${r.errors} · ${r.count}` : String(r.count)}
          </Text>
        </Pressable>
      ))}
      {everything.length > TOOLS_SHOWN && !all ? (
        <Pressable onPress={onMore} accessibilityRole="button" testID="wbo-panel-moretools">
          <Text style={s.link}>{t.moreTools(everything.length - TOOLS_SHOWN)}</Text>
        </Pressable>
      ) : null}
      {panel.tools?.more ? <Text style={s.dim}>{t.moreTools(panel.tools.more)}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: space.xl },
  wrap: { paddingHorizontal: gutter },
  center: { paddingVertical: space.xl, alignItems: 'center' },
  sec: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch, paddingVertical: space.xs },
  headText: { flex: 1, fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.ink, letterSpacing: 0.3 },
  count: { maxWidth: '64%', fontFamily: fonts.mono, fontSize: type.small, color: colors.inkDim, textAlign: 'right' },
  body: { paddingBottom: space.md, gap: space.xs },
  model: { fontFamily: fonts.sansSemi, fontSize: type.body, color: colors.inkBright, lineHeight: 21 },
  sub: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim, marginBottom: space.xs },
  dim: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  warn: { color: colors.warn },
  bad: { color: colors.danger },
  ctxWrap: { marginVertical: space.sm },
  ctx: { fontFamily: fonts.mono, fontSize: type.small, color: colors.ink },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.line, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.inkDim },
  barWarn: { backgroundColor: colors.warn },
  barBad: { backgroundColor: colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kv: { flexDirection: 'row', alignItems: 'baseline', width: '48%', paddingVertical: 1 },
  kvKey: { flex: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  kvVal: { fontFamily: fonts.mono, fontSize: type.tiny, color: colors.ink },
  cost: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    marginTop: space.xs,
    paddingTop: space.xs,
  },
  cwd: { fontFamily: fonts.mono, fontSize: type.tiny, color: colors.inkDim, marginTop: 2 },
  todo: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 3 },
  todoText: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  todoDone: { color: colors.inkDim, textDecorationLine: 'line-through' },
  row: { paddingVertical: space.xs, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  filecol: { flex: 1, minWidth: 0 },
  rowText: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  dir: { fontFamily: fonts.sans, fontSize: type.micro, color: colors.inkDim, marginTop: 1 },
  rowMeta: { maxWidth: '52%', fontFamily: fonts.mono, fontSize: type.micro, color: colors.inkDim, textAlign: 'right' },
  ask: { paddingVertical: space.sm, gap: space.xs },
  askHead: { fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.ink },
  res: {
    fontFamily: fonts.mono,
    fontSize: type.micro,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  jump: { paddingTop: space.xs },
  link: { fontFamily: fonts.sans, fontSize: type.small, color: colors.accent, paddingVertical: space.xs },
  /* the one line above the sections: a question stops the run, so it is not a section that can be folded */
  wait: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, paddingHorizontal: space.xs,
          borderWidth: 1, borderColor: colors.warn, borderRadius: radius.sm, marginBottom: space.sm },
  waitDot: { width: 6, height: 6, borderRadius: 3 },
  waitText: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  /* what it spent, on one line; the numbers whole in the grid under it */
  spend: { fontFamily: fonts.mono, fontSize: type.small, color: colors.ink, marginTop: space.xs },
  /* what the run is on, right now */
  nowLine: { fontFamily: fonts.sans, fontSize: type.small, color: colors.ink, marginBottom: space.xs },
  nowKey: { fontFamily: fonts.sans, fontSize: type.micro, color: colors.inkDim, textTransform: 'uppercase' },
  /* the todo list's bar and the one item under way */
  todosLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, minHeight: 32 },
  todoBar: { width: 64, height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  todoBarFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  /* the foot: one dim line, its details under a tap */
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line,
          marginTop: space.sm, paddingTop: space.sm, minHeight: 32 },
  footDot: { width: 6, height: 6, borderRadius: 3 },
  footText: { flex: 1, fontFamily: fonts.mono, fontSize: type.micro, color: colors.inkDim },
  diff: { fontFamily: fonts.mono, fontSize: type.tiny, color: colors.inkDim },
  out: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  tempRow: { opacity: 0.8 },
  ratio: { position: 'absolute', left: 0, top: 3, bottom: 3, borderRadius: 4, backgroundColor: colors.surface },
  toolName: { flex: 1 },

});
