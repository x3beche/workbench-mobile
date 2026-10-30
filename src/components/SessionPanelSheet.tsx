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
  FILES_SHOWN,
  fileLine,
  kfmt,
  panelSections,
  stateWord,
  toolLine,
  workedFor,
  type PanelSectionId,
} from '../lib/wboPanel';
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
  const sections = panelSections(panel, t, folds);
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
                  {sec.id === 'pending' ? (
                    <PendingBody panel={panel} t={t} mayAnswer={mayAnswer} onAnswer={onAnswer} onJump={onJump} />
                  ) : null}
                  {sec.id === 'todos' ? <TodosBody panel={panel} /> : null}
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
                  {sec.id === 'model' ? (
                    <ModelBody panel={panel} t={t} now={now} onModel={onModel} copied={copied} />
                  ) : null}
                  {sec.id === 'computer' ? <ComputerBody panel={panel} t={t} onCopy={copy} copied={copied} /> : null}
                  {sec.id === 'tools' ? <ToolsBody panel={panel} t={t} onJump={onJump} /> : null}
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
      <View style={s.grid}>
        <Row k={t.input} v={kfmt(panel.tokens.input)} />
        <Row k={t.output} v={kfmt(panel.tokens.output)} />
        {panel.tokens.cache_read != null ? <Row k={t.cacheRead} v={kfmt(panel.tokens.cache_read)} /> : null}
        {panel.tokens.cache_write != null ? <Row k={t.cacheWrite} v={kfmt(panel.tokens.cache_write)} /> : null}
      </View>
      <View style={s.cost}>
        <Text style={s.kvKey}>{t.run.cost}</Text>
        <Text style={s.kvVal}>{panel.tokens.cost != null ? `$${panel.tokens.cost.toFixed(2)}` : '–'}</Text>
      </View>
      {panel.tokens.source === 'messages' ? <Text style={s.dim}>{t.lastMessages(panel.tokens.messages)}</Text> : null}
    </View>
  );
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
      {c.name && c.name !== c.host ? (
        <Text style={s.dim} numberOfLines={1}>
          {`${t.deviceKey}: ${c.name}`}
        </Text>
      ) : null}
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
  const rows = all ? everything : everything.slice(0, FILES_SHOWN);
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
      {everything.length > FILES_SHOWN && !all ? (
        <Pressable onPress={onAll} accessibilityRole="button" testID="wbo-panel-allfiles">
          <Text style={s.link}>{t.allFiles(everything.length)}</Text>
        </Pressable>
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
          accessibilityLabel={toolLine(r, t)}
          testID="wbo-panel-tool"
        >
          <Text style={s.rowText} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[s.rowMeta, r.errors ? s.warn : null]} numberOfLines={1}>
            {r.errors ? `${r.count} · ⚠${r.errors}` : String(r.count)}
          </Text>
        </Pressable>
      ))}
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
});
