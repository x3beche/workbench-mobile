/**
 * Mount it to open it. One OpenCode session's column, as the web app's right-hand column draws it
 * (rooms/session-panel.ts; backend/wb_panel.py): the model and its window, what it spent, the computer it runs
 * on, its todo list, the files it changed, what it is waiting for and the tools it used.
 *
 * The same rules as the web: a section with nothing in it is not drawn, a section's fold is the person's (kept
 * on the server, /api/me/side `panel`, so it is the same on the phone and in the browser), a file or a tool row
 * scrolls the conversation to the call it happened in, and a permission is answered from here (once / always /
 * reject) - a question's own form is answered in the conversation, where the fields are.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { PanelFile, PanelTool, WboAsk, WboPanel } from '../api/types';
import {
  fileLine,
  panelSections,
  shortPath,
  stateWord,
  toolLine,
  type PanelSectionId,
} from '../lib/wboPanel';
import type { WboStrings } from '../lib/wboStrings';
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
  /** "12 min ago" for a row's own time, in the page's language. */
  when: (at: number | null) => string;
}) {
  const [panel, setPanel] = useState<WboPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folds, setFolds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPanel(null);
    setError(null);
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

  const sections = panelSections(panel, t);
  const mayAnswer = panel?.may_answer === true;

  return (
    <TallSheet title={t.columnTitle} sub={panel?.session.title || t.session} closeLabel={t.close} onClose={onClose} testID="wbo-panel">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!panel && !error ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.inkDim} accessibilityLabel={t.readingColumn} />
        </View>
      ) : null}
      <SafeAreaView edges={['bottom', 'left', 'right']} style={s.wrap}>
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
              {sec.count ? (
                <Text style={[s.count, sec.warn ? s.warn : null]} numberOfLines={1} testID={`wbo-count-${sec.id}`}>
                  {sec.count}
                </Text>
              ) : null}
            </Pressable>
            {isOpen(sec.id) && panel ? (
              <View style={s.body}>
                {sec.id === 'model' ? <ModelBody panel={panel} t={t} /> : null}
                {sec.id === 'computer' ? <ComputerBody panel={panel} t={t} /> : null}
                {sec.id === 'todos' ? <TodosBody panel={panel} t={t} /> : null}
                {sec.id === 'files' ? <FilesBody panel={panel} t={t} when={when} onJump={onJump} /> : null}
                {sec.id === 'pending' ? (
                  <PendingBody panel={panel} t={t} mayAnswer={mayAnswer} onAnswer={onAnswer} onJump={onJump} />
                ) : null}
                {sec.id === 'tools' ? <ToolsBody panel={panel} t={t} onJump={onJump} /> : null}
              </View>
            ) : null}
          </View>
        ))}
      </SafeAreaView>
    </TallSheet>
  );
}

function kv(k: string, v: string) {
  return (
    <View key={k} style={s.kv}>
      <Text style={s.kvKey} numberOfLines={1}>
        {k}
      </Text>
      <Text style={s.kvVal} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

function ModelBody({ panel, t }: { panel: WboPanel; t: WboStrings }) {
  const m = panel.session.model;
  const c = panel.session.context;
  const pct = c?.pct ?? null;
  return (
    <View>
      <Text style={s.model} numberOfLines={1} testID="wbo-panel-model">
        {m?.name || m?.modelID || t.model}
        {m?.providerName ? <Text style={s.dim}>{` · ${m.providerName}`}</Text> : null}
        {m?.variant ? <Text style={s.dim}>{` · ${m.variant}`}</Text> : null}
      </Text>
      {c ? (
        <View style={s.ctxWrap}>
          <View style={s.ctxRow}>
            <Text style={[s.ctx, pct != null && pct >= 80 ? s.warn : null]} testID="wbo-panel-context">
              {`${kfmt(c.used)} / ${c.limit ? kfmt(c.limit) : '?'}`}
            </Text>
            {pct != null ? <Text style={[s.ctxPct, pct >= 80 ? s.warn : null]}>{`${pct}%`}</Text> : null}
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, pct != null && pct >= 80 ? s.barWarn : null, { width: `${pct ?? 0}%` }]} />
          </View>
        </View>
      ) : null}
      {kv(t.run.tokensIn, kfmt(panel.tokens.input))}
      {kv(t.run.tokensOut, kfmt(panel.tokens.output))}
      {panel.tokens.cache_read ? kv(t.run.fromCache, kfmt(panel.tokens.cache_read)) : null}
      {panel.tokens.cache_write ? kv(t.run.writtenToCache, kfmt(panel.tokens.cache_write)) : null}
      {panel.tokens.cost != null ? kv(t.run.cost, `$${panel.tokens.cost.toFixed(2)}`) : null}
      <Text style={s.state} testID="wbo-panel-state">
        {stateWord(panel, t)}
      </Text>
    </View>
  );
}

function ComputerBody({ panel, t }: { panel: WboPanel; t: WboStrings }) {
  const c = panel.session.computer;
  if (!c) return null;
  return (
    <View>
      <Text style={s.model} numberOfLines={1}>
        {c.name || c.host || t.opencode}
      </Text>
      <Text style={s.dim} numberOfLines={1}>
        {c.connected ? c.host : t.notConnectedShort}
      </Text>
      <Text style={s.dim} numberOfLines={1}>
        {`wb-opencode ${c.version || '?'}`}
      </Text>
      {c.outdated && !c.self_updates ? <Text style={s.warn}>{t.updateWboLong}</Text> : null}
      {c.cwd ? (
        <Text style={s.cwd} numberOfLines={1}>
          {c.cwd}
        </Text>
      ) : null}
    </View>
  );
}

const TODO_ICON = {
  pending: Square,
  in_progress: Activity,
  completed: Check,
  cancelled: X,
} as const;

function TodosBody({ panel, t }: { panel: WboPanel; t: WboStrings }) {
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
      {panel.todos ? <Text style={s.dim}>{t.doneOf(panel.todos.done, panel.todos.total)}</Text> : null}
    </View>
  );
}

function FilesBody({
  panel,
  t,
  when,
  onJump,
}: {
  panel: WboPanel;
  t: WboStrings;
  when: (at: number | null) => string;
  onJump: (message: string) => void;
}) {
  const rows: PanelFile[] = panel.files?.items ?? [];
  return (
    <View>
      {rows.map((f) => (
        <Pressable
          key={f.path}
          onPress={() => onJump(f.message)}
          accessibilityRole="button"
          accessibilityHint={t.showInConversation}
          style={s.row}
          testID="wbo-panel-file"
        >
          <Text style={[s.rowText, f.error ? s.warn : null]} numberOfLines={1}>
            {shortPath(f.path)}
          </Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {fileLine(f, when(f.at))}
          </Text>
        </Pressable>
      ))}
      {panel.files?.more ? <Text style={s.dim}>{t.moreFiles(panel.files.more)}</Text> : null}
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
}: {
  panel: WboPanel;
  t: WboStrings;
  onJump: (message: string) => void;
}) {
  const rows: PanelTool[] = panel.tools?.items ?? [];
  return (
    <View>
      {rows.map((r) => (
        <Pressable
          key={`${r.server}:${r.name}`}
          onPress={() => onJump(r.message)}
          accessibilityRole="button"
          accessibilityHint={t.showInConversation}
          style={s.row}
          testID="wbo-panel-tool"
        >
          <Text style={s.rowText} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[s.rowMeta, r.errors ? s.warn : null]} numberOfLines={1}>
            {r.errors ? toolLine(r) + ' · ' + t.failedTimes(r.errors) : String(r.count)}
          </Text>
        </Pressable>
      ))}
      {panel.tools?.more ? <Text style={s.dim}>{t.moreTools(panel.tools.more)}</Text> : null}
    </View>
  );
}

function kfmt(n: number): string {
  if (n >= 999.95e6) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(2)}k`;
  if (n >= 1000) return n.toLocaleString('en-US');
  return String(Math.round(n));
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingBottom: space.xl },
  center: { paddingVertical: space.xl, alignItems: 'center' },
  sec: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch,
    paddingVertical: space.sm,
  },
  headText: { flex: 1, fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.ink, letterSpacing: 0.3 },
  count: { fontFamily: fonts.mono, fontSize: type.small, color: colors.inkDim },
  body: { paddingBottom: space.md, gap: space.xs },
  model: { fontFamily: fonts.sansSemi, fontSize: type.body, color: colors.inkBright, marginBottom: space.xs },
  dim: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  warn: { color: colors.warn },
  state: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim, marginTop: space.sm },
  ctxWrap: { marginVertical: space.sm },
  ctxRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  ctx: { fontFamily: fonts.mono, fontSize: type.small, color: colors.ink },
  ctxPct: { marginLeft: 'auto', fontFamily: fonts.mono, fontSize: type.small, color: colors.inkDim },
  bar: { height: 3, borderRadius: radius.round, backgroundColor: colors.line, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.inkDim },
  barWarn: { backgroundColor: colors.warn },
  kv: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 1 },
  kvKey: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  kvVal: { fontFamily: fonts.mono, fontSize: type.small, color: colors.ink },
  cwd: { fontFamily: fonts.mono, fontSize: type.tiny ?? type.small, color: colors.inkDim, marginTop: 2 },
  todo: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 3 },
  todoText: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  todoDone: { color: colors.inkDim, textDecorationLine: 'line-through' },
  row: { paddingVertical: space.sm, flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  rowText: { flex: 1, fontFamily: fonts.mono, fontSize: type.small, color: colors.ink },
  rowMeta: { fontFamily: fonts.mono, fontSize: type.small, color: colors.inkDim },
  ask: { paddingVertical: space.sm, gap: space.xs },
  askHead: { fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.ink },
  res: {
    fontFamily: fonts.mono,
    fontSize: type.small,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  jump: { paddingTop: space.xs },
  link: { fontFamily: fonts.sans, fontSize: type.small, color: colors.accent },
});
