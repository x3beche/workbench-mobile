/**
 * Mount it to open it. One OpenCode session's column, as the web app's right-hand column draws it
 * (rooms/session-panel.ts; backend/wb_panel.py): what it is waiting for, its todo list, the files it changed,
 * the model and its window, the computer it runs on and the tools it used - in that order, the things that
 * need a person first.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { PanelFile, PanelRecentCall, PanelTool, WboAsk, WboPanel } from '../api/types';
import {
  baseName,
  ctxLine,
  ctxTip,
  ctxTone,
  dirName,
  estOf,
  footDir,
  footFlag,
  kfmt,
  panelSections,
  stallNote,
  stateWord,
  toolLine,
  tookFor,
  waitingLine,
  workedFor,
  type PanelSectionId,
} from '../lib/wboPanel';
import { catColor, ContextChart, DiffSpark, FlowStrip } from './PanelCharts';
import { Choice } from './Choice';
import type { RangeId } from '../lib/sessionFlow';
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
  onContext,
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
  const [allRecent, setAllRecent] = useState(false);
  const [range, setRange] = useState<RangeId>('auto');
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPanel(null);
    setError(null);
    setAllFiles(false);
    setAllRecent(false);
    if (client) {
      client
        .side()
        .then((p) => setFolds(p.panel ?? {}))
        .catch(() => undefined);
    }
  }, [client, sid]);

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
    const open = isOpen(id);
    setFolds((f) => ({ ...f, [id]: !open }));
    client?.sidePanel(id, !open).catch(() => undefined);
  };
  const isOpen = (id: PanelSectionId) => (id === 'computer' ? folds[id] === true : folds[id] !== false);

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
                <Glyph icon={isOpen(sec.id) ? ChevronDown : ChevronRight} size={11} color={colors.inkDim} />
                <Text style={[s.headText, sec.warn ? s.warn : null]} numberOfLines={1}>
                  {sec.label}
                </Text>
                {sec.id === 'files' ? <DiffSpark points={panel?.series?.diff_series ?? []} /> : null}
                {sec.id === 'computer' && panel.session.computer ? (
                  <View style={s.compHeaderRight} testID="wbo-count-computer">
                    {footFlag(panel.session.computer) ? (
                      <View style={s.warnBadge}>
                        <Text style={s.warnBadgeText}>{footFlag(panel.session.computer)!.text}</Text>
                      </View>
                    ) : null}
                    <View style={s.compNameRow}>
                      <Text style={[s.count, sec.warn && !panel.session.computer.connected ? s.warn : null]} numberOfLines={1}>
                        {panel.session.computer.host || panel.session.computer.name || t.opencode}
                      </Text>
                      <View style={[s.compDot, { backgroundColor: panel.session.computer.connected ? colors.ok : colors.inkDim }]} />
                    </View>
                  </View>
                ) : sec.count ? (
                  <Text style={[s.count, sec.warn ? s.warn : null]} numberOfLines={1} testID={`wbo-count-${sec.id}`}>
                    {sec.count}
                  </Text>
                ) : null}
              </Pressable>
              {isOpen(sec.id) && panel ? (
                <View style={s.body}>
                  {sec.id === 'model' ? (
                    <ModelBody panel={panel} t={t} now={now} onModel={onModel} onContext={onContext}
                               copied={copied} />
                  ) : null}
                  {sec.id === 'flow' ? (
                    <FlowBody
                      panel={panel}
                      t={t}
                      now={now}
                      range={range}
                      onRange={setRange}
                      onJump={onJump}
                      allRecent={allRecent}
                      onAllRecent={() => setAllRecent(!allRecent)}
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
                  {sec.id === 'computer' ? (
                    <ComputerBody
                      panel={panel}
                      t={t}
                      onCopy={copy}
                      copied={copied}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
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
  onContext,
  copied,
}: {
  panel: WboPanel;
  t: WboStrings;
  now: number;
  onModel: () => void;
  onContext: (limit: number | null) => void;
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
        <Text style={s.modelName} numberOfLines={2} testID="wbo-panel-model">
          {m?.name || m?.modelID || t.model}
        </Text>
        {sub ? (
          <Text style={s.modelSub} numberOfLines={1}>
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
      {/* the window it keeps to: a smaller one makes OpenCode compact sooner (the bar above is read against
          it), and the sizes are the ones the model's own window allows */}
      {panel.session.context_options?.can && panel.session.context_options.steps?.length ? (
        <View style={s.ctxPick} testID="wbo-panel-ctxpick">
          <Text style={s.dim}>{t.context}</Text>
          <Choice
            label={t.context}
            value={panel.session.context_limit ? String(panel.session.context_limit) : ''}
            options={[
              { id: '', label: panel.session.context_options.max
                  ? `${t.contextOwn} · ${sizeWord(panel.session.context_options.max)}` : t.contextOwn },
              ...panel.session.context_options.steps.map((n) => ({ id: String(n), label: sizeWord(n) })),
            ]}
            onChange={(v) => onContext(v ? Number(v) : null)}
          />
        </View>
      ) : null}
      {/* the window over the turns: the line says when this session is to be left */}
      <ContextChart points={panel.series?.context ?? []} limit={c?.limit ?? 0} tone={tone} testID="wbo-panel-ctxchart" />
      {estimate(panel, t) ? <Text style={s.estimate}>{estimate(panel, t)}</Text> : null}
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

function FlowBody({
  panel,
  t,
  now,
  range,
  onRange,
  onJump,
  allRecent,
  onAllRecent,
}: {
  panel: WboPanel;
  t: WboStrings;
  now: number;
  range: RangeId;
  onRange: (id: RangeId) => void;
  onJump: (message: string) => void;
  allRecent: boolean;
  onAllRecent: () => void;
}) {
  const working = panel.session.status === 'busy' || panel.session.status === 'retry';
  const recent = panel.series?.recent ?? [];
  const lastCall = recent[recent.length - 1];

  const step = useMemo(() => {
    if (!lastCall) return null;
    const end = lastCall.end ?? now;
    const running = working && lastCall.status !== 'completed' && lastCall.status !== 'error';
    return {
      tool: lastCall.tool || catWord(lastCall.cat, t),
      title: lastCall.title,
      took: running ? workedFor(lastCall.start ?? now, now) : tookFor(lastCall, now),
      color: catColor(lastCall.cat),
    };
  }, [lastCall, working, now, t]);

  const stall = stallNote(panel, t, now);
  const recentShown = useMemo(() => {
    const list = [...recent].reverse();
    return allRecent ? list : list.slice(0, 5);
  }, [recent, allRecent]);

  const todos = panel.todos;
  const [todoOpen, setTodoOpen] = useState(false);
  const current =
    todos?.items.find((r) => r.status === 'in_progress')?.content ?? todos?.items.find((r) => r.status === 'pending')?.content ?? '';

  return (
    <View>
      {step ? (
        <View style={s.stepBox} testID="wbo-panel-now">
          <View style={s.stepRow}>
            <Text style={[s.stepTool, { color: step.color }]}>{step.tool}</Text>
            <Text style={s.stepTook}>{step.took}</Text>
          </View>
          <Text style={s.stepTitle} numberOfLines={1} ellipsizeMode="tail">
            {step.title}
          </Text>
        </View>
      ) : null}
      {stall ? <Text style={s.stall}>{stall}</Text> : null}
      <FlowStrip
        series={panel.series}
        now={now}
        working={working}
        range={range}
        onRange={onRange}
        onJump={onJump}
        stall={stall}
        testID="wbo-panel-strip"
      />
      {recent.length ? (
        <View style={s.recentBox}>
          {recentShown.map((r, i) => (
            <Pressable
              key={`${r.part}:${r.start}:${i}`}
              style={s.recentRow}
              onPress={() => onJump(r.part)}
              accessibilityRole="button"
              testID="wbo-panel-recent"
            >
              <Text style={[s.stateMark, r.status === 'completed' && s.stateOk, r.status === 'error' && s.stateErr]}>
                {r.status === 'completed' ? '✓' : r.status === 'error' ? '✕' : '●'}
              </Text>
              <View style={[s.recentDot, { backgroundColor: catColor(r.cat) }]} />
              <Text style={s.recentTitle} numberOfLines={1}>
                {r.title || r.tool}
              </Text>
              {r.add != null ? (
                <Text style={s.recentDiff}>
                  <Text style={s.diffAdd}>+{r.add}</Text> <Text style={s.diffDel}>−{r.del}</Text>
                </Text>
              ) : null}
              <Text style={s.recentTook}>{tookFor(r, now)}</Text>
            </Pressable>
          ))}
          {recent.length > 5 ? (
            <Pressable onPress={onAllRecent} accessibilityRole="button" style={s.recentMore}>
              <Text style={s.link}>{allRecent ? t.fewer : t.showAll(recent.length)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : !recent.length && panel.tools?.items.length ? (
        <View style={s.recentBox}>
          <Pressable accessibilityRole="button" testID="wbo-panel-tools">
            <Text style={s.link}>{t.whichTools}</Text>
          </Pressable>
          {panel.tools.items.slice(0, 5).map((r) => (
            <Pressable key={`${r.server}:${r.name}`} onPress={() => onJump(r.message)} accessibilityRole="button"
                       style={s.recentRow} testID="wbo-panel-tool">
              <Text style={s.recentTitle} numberOfLines={1}>{r.name}</Text>
              <Text style={s.recentTook}>{toolLine(r, t)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
    </View>
  );
}

/** A window in the few words the sheet has room for: 64k, 256k, 1M. */
function sizeWord(n: number): string {
  return n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : `${Math.round(n / 1000)}k`;
}

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
  const dir = footDir(c.cwd || panel.session.directory || '');
  const mcp = c.mcp ?? [];
  const ok = mcp.filter((m) => m.status === 'connected').length;
  const mcpText = mcp.length
    ? (mcp.length === 1
        ? `${mcp[0].name} ${mcp[0].status === 'connected' ? '✓' : '✕'}`
        : `${ok}/${mcp.length}`)
    : (c.connected ? 'none' : '—');
  const mcpWarn = mcp.length > 0 && ok < mcp.length;

  return (
    <View style={s.compBody} testID="wbo-panel-computer">
      {/* Computer: name ● */}
      <View style={s.compRow}>
        <Text style={s.compLabel}>{t.computer}</Text>
        <View style={s.compValRow}>
          <Text style={s.compValText} numberOfLines={1}>
            {c.host || c.name || t.opencode}
          </Text>
          <View style={[s.compDot, { backgroundColor: c.connected ? colors.ok : colors.inkDim }]} />
        </View>
      </View>

      {/* Folder: path shortened from start; tap to copy */}
      {dir ? (
        <Pressable
          onPress={() => onCopy(c.cwd || panel.session.directory || '')}
          accessibilityRole="button"
          accessibilityHint={t.copy}
          style={s.compRow}
          testID="wbo-panel-cwd"
        >
          <Text style={s.compLabel}>{t.folder}</Text>
          <View style={s.compValRow}>
            <Text style={[s.compValText, s.mono]} numberOfLines={1}>
              {dir}
            </Text>
            {copied ? <Text style={s.copiedTag}>{t.copied}</Text> : null}
          </View>
        </Pressable>
      ) : null}

      {/* wb-opencode: version (with update note if out of date) */}
      <View style={s.compRow}>
        <Text style={s.compLabel}>wb-opencode</Text>
        <View style={s.compValCol}>
          <Text style={[s.compValText, s.mono]}>
            {c.version || '?'}
          </Text>
          {c.outdated && !c.self_updates ? (
            <Text style={s.updateNote}>{t.updateWboLong}</Text>
          ) : null}
        </View>
      </View>

      {/* MCP: state (e.g. workbench ✓, or 1/2 warn) */}
      <View style={s.compRow}>
        <Text style={s.compLabel}>MCP</Text>
        <Text style={[s.compValText, s.mono, mcpWarn ? s.warn : null]}>
          {mcpText}
        </Text>
      </View>
    </View>
  );
}

const TODO_ICON = { pending: Square, in_progress: Activity, completed: Check, cancelled: X } as const;

function TodosBody({ panel }: { panel: WboPanel }) {
  const rows = panel.todos?.items ?? [];
  return (
    <View style={s.todoList}>
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
        const est = estOf(f);
        return (
          <Pressable
            key={f.path}
            onPress={() => onJump(f.message)}
            accessibilityRole="button"
            accessibilityHint={t.showInConversation}
            style={s.fileRow}
            testID="wbo-panel-file"
          >
            <View style={s.filecol}>
              <View style={s.fileTop}>
                <Text style={s.fileName} numberOfLines={1}>
                  {baseName(f.path)}
                </Text>
                {f.additions != null ? (
                  <Text style={s.diff}>
                    <Text style={s.diffAdd}>+{f.additions}</Text> <Text style={s.diffDel}>−{f.deletions}</Text>
                  </Text>
                ) : est ? (
                  <Text style={[s.diff, s.estDiff]} accessibilityLabel={t.estimated}>
                    <Text style={s.diffAdd}>+{est.add}</Text> <Text style={s.diffDel}>−{est.del}</Text>
                  </Text>
                ) : null}
                {f.outside ? <Text style={s.out}>↗</Text> : null}
              </View>
              {dirName(f.path) ? (
                <Text style={s.dir} numberOfLines={1} ellipsizeMode="head">
                  {dirName(f.path)}
                </Text>
              ) : null}
            </View>
            {showAt ? (
              <Text style={s.fileWhen} numberOfLines={1}>
                {showAt}
              </Text>
            ) : null}
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
                           style={[s.fileRow, s.tempRow]} testID="wbo-panel-tempfile">
                  <Text style={s.fileName} numberOfLines={1}>
                    {baseName(f.path)}
                  </Text>
                </Pressable>
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: space.xl },
  wrap: { paddingHorizontal: gutter },
  center: { paddingVertical: space.xl, alignItems: 'center' },
  sec: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingVertical: 6 },
  headText: { flex: 1, fontFamily: fonts.sansSemi, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.ink },
  count: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim, textAlign: 'right' },
  body: { paddingBottom: space.sm, gap: space.xs },
  modelName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkBright, lineHeight: 18 },
  modelSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim, marginTop: 2, marginBottom: 4 },
  dim: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  warn: { color: colors.warn },
  bad: { color: colors.danger },
  ctxWrap: { marginVertical: 4 },
  ctx: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.line, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.inkDim },
  barWarn: { backgroundColor: colors.warn },
  barBad: { backgroundColor: colors.danger },
  estimate: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.inkDim, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  kv: { flexDirection: 'row', alignItems: 'baseline', width: '48%', paddingVertical: 1 },
  kvKey: { flex: 1, fontFamily: fonts.sans, fontSize: 10.5, color: colors.inkDim },
  kvVal: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink },
  todoList: { marginTop: 4 },
  todo: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 3 },
  todoText: { flex: 1, fontFamily: fonts.sans, fontSize: 11, color: colors.ink },
  todoDone: { color: colors.inkDim, textDecorationLine: 'line-through' },
  stepBox: { paddingVertical: 2, marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stepTool: { fontFamily: fonts.sansMedium, fontSize: 12, fontWeight: '500' },
  stepTook: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim },
  stepTitle: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkDim, marginTop: 1 },
  stall: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.warn, marginVertical: 3 },
  recentBox: { marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 4 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  stateMark: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim, width: 10 },
  stateOk: { color: colors.ok },
  stateErr: { color: colors.danger },
  recentDot: { width: 6, height: 6, borderRadius: 2 },
  recentTitle: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  recentDiff: { fontFamily: fonts.mono, fontSize: 10.5 },
  recentTook: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim },
  recentMore: { paddingVertical: 4 },
  fileRow: { paddingVertical: 4, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  filecol: { flex: 1, minWidth: 0 },
  fileTop: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  fileName: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  fileDir: { fontFamily: fonts.mono, fontSize: 10, color: colors.inkDim, marginTop: 1 },
  fileWhen: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim, marginLeft: 8 },
  diff: { fontFamily: fonts.mono, fontSize: 10.5 },
  diffAdd: { color: colors.ok, fontWeight: '600' },
  diffDel: { color: colors.danger, fontWeight: '600' },
  estDiff: { opacity: 0.55 },
  out: { fontFamily: fonts.sans, fontSize: 10, color: colors.inkDim },
  dir: { fontFamily: fonts.mono, fontSize: 10, color: colors.inkDim, marginTop: 1 },
  link: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim, paddingVertical: 2 },
  wait: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, paddingHorizontal: space.xs,
          borderWidth: 1, borderColor: colors.warn, borderRadius: radius.sm, marginBottom: space.sm },
  waitDot: { width: 6, height: 6, borderRadius: 3 },
  waitText: { flex: 1, fontFamily: fonts.sans, fontSize: 11, color: colors.ink },
  spend: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkDim, marginTop: 4 },
  todosLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, minHeight: 28 },
  todoBar: { width: 64, height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  todoBarFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  compHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  compNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  compDot: { width: 5, height: 5, borderRadius: 2.5 },
  warnBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  warnBadgeText: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.warn },
  compBody: { paddingVertical: 4, gap: 6 },
  compRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: 12,
  },
  compLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },
  compValRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  compValCol: { alignItems: 'flex-end', flexShrink: 1 },
  compValText: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink, textAlign: 'right' },
  mono: { fontFamily: fonts.mono },
  copiedTag: { fontFamily: fonts.sans, fontSize: 9.5, color: colors.ok, marginLeft: 4 },
  updateNote: { fontFamily: fonts.sans, fontSize: 10, color: colors.warn, marginTop: 1 },
  tempRow: { opacity: 0.8 },
});
