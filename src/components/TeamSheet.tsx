/**
 * A manager session's Team, as the web app's right-hand column draws it (frontend/src/app/rooms/team-panel.ts)
 * in a sheet that rises from the bottom. One list, one block an agent: its state dot, its name and how much of
 * its window it uses, then the tasks it holds (an id and a title that wraps rather than being cut, the state
 * and the time it is taking at the right), then the agent's own last word as one dim line a tap opens in the
 * same small type. An agent holding nothing gets one line: the task it closed last. What waits on the person
 * comes first, then what works, then the idle; the closed tasks are folded at the foot, grouped by agent.
 * One answer carries it all (GET /api/agents/team/{manager}); it is read when the bus says the agents changed
 * and every fifteen seconds while the sheet is open. Nothing here writes: the work is given in the conversation,
 * this only says how it is going.
 *
 * Mount it to open it, as the OpenCode session's column is (components/SessionPanelSheet.tsx).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { TeamAgent, TeamAnswer, TeamTask } from '../api/types';
import { useBus } from '../live/LiveContext';
import { inFront } from '../live/hub';
import {
  agentsInOrder,
  barTone,
  closedTasks,
  dotTone,
  groupClosed,
  idleLine,
  lastClosed,
  oneLine,
  openTasks,
  pctOf,
  reportLine,
  shortTask,
  tasksOf,
  took,
  when,
} from '../lib/team';
import type { TeamStrings } from '../lib/teamStrings';
import { colors, fonts, gutter, space, type } from '../theme/tokens';
import { ChevronDown, ChevronRight } from './icons';
import { StateDot } from './StateDot';
import { TallSheet } from './TallSheet';
import { ErrorText, Glyph } from './ui';

/** While the sheet is open, its team is read this often: a task's state changes without a word on the bus. */
const REFRESH_MS = 15_000;

export function TeamSheet({
  client,
  sid,
  t,
  sub,
  onClose,
  onOpenAgent,
}: {
  client: WorkbenchClient | null;
  /** The manager's own Claude Code session: its team is `wbc:<sid>`. */
  sid: string;
  t: TeamStrings;
  /** A line under the sheet's title (the session's name). */
  sub?: string;
  onClose: () => void;
  /** An agent's row was tapped: its own session takes the screen. */
  onOpenAgent: (key: string) => void;
}) {
  const [data, setData] = useState<TeamAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The tasks whose own word is open, and whether the closed ones are shown. */
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const [closedOpen, setClosedOpen] = useState(false);
  /** When the answer was read: a row's age is said against it (set with every read). */
  const [now, setNow] = useState(0);
  /** How tall the content is: the sheet takes what it says and no empty grey under it, up to 86% of the screen. */
  const { height: screenH } = useWindowDimensions();
  const [box, setBox] = useState(0);
  const height = box ? Math.min(0.86, Math.max(0.35, (box + 96) / screenH)) : 0.45;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const manager = `wbc:${sid}`;
  const load = useCallback(() => {
    if (!client) return;
    client.agentTeam(manager).then(
      (got) => {
        if (!mounted.current) return;
        setData(got);
        setError(null);
        setNow(Date.now());
      },
      (e) => {
        if (!mounted.current) return;
        // The sheet keeps what it had: a team that cannot be read says nothing rather than shouting.
        setError(e instanceof ApiError && e.status !== 0 ? e.message : t.failed);
      },
    );
  }, [client, manager, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (inFront()) load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // The bus: something about the agents changed. Read the team again (the page sends it under the same name).
  useBus(['agents'], () => {
    if (inFront()) load();
  });

  const reload = () => {
    setError(null);
    load();
  };

  const flip = (id: string) =>
    setShown((held) => {
      const next = new Set(held);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const open = data ? openTasks(data.tasks) : [];
  const closed = data ? closedTasks(data.tasks) : [];
  const agents = data ? agentsInOrder(data.agents) : [];
  const working = agents.filter((a) => dotTone(a.state) === 'ok').length;

  return (
    <TallSheet
      title={t.title}
      sub={sub}
      closeLabel={t.close}
      onClose={onClose}
      testID="wbc-team-sheet"
      height={height}
    >
      {error ? (
        <View style={s.err}>
          <ErrorText>{error}</ErrorText>
          <Pressable onPress={reload} accessibilityRole="button" testID="team-retry">
            <Text style={s.retry}>{t.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {!data && !error ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.inkDim} accessibilityLabel={t.reading} />
        </View>
      ) : null}
      {data ? (
        <ScrollView
          contentContainerStyle={s.scroll}
          onContentSizeChange={(_w, h) => setBox(h)}
          testID="team-scroll"
        >
          <SafeAreaView edges={['left', 'right']} style={s.wrap}>
            <View style={s.counts} testID="team-counts">
              <Text style={s.countsText}>
                {t.agentsLine(data.agents.length)} · {t.workingLine(working)}
              </Text>
            </View>
            {agents.length ? (
              agents.map((a) => (
                <AgentBlock
                  key={a.agent}
                  a={a}
                  tasks={tasksOf(a, open)}
                  last={lastClosed(a.agent, closed)}
                  t={t}
                  now={now}
                  shown={shown}
                  onOpenAgent={onOpenAgent}
                  onFlip={flip}
                />
              ))
            ) : (
              <Text style={s.dim} testID="team-empty-agent">
                {t.none}
              </Text>
            )}
            {closed.length ? (
              <View style={s.closedBox}>
                <Pressable
                  onPress={() => setClosedOpen(!closedOpen)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: closedOpen }}
                  style={s.closedHead}
                  testID="team-closed"
                >
                  <Glyph icon={closedOpen ? ChevronDown : ChevronRight} size={11} color={colors.inkDim} />
                  <Text style={s.dim}>{t.closed(closed.length)}</Text>
                </Pressable>
                {closedOpen
                  ? groupClosed(agents, closed).map((g) => (
                      <View key={g.agent} testID={`team-closed-group-${g.agent}`}>
                        <Text style={s.closedAgent} numberOfLines={1}>
                          {g.name}
                        </Text>
                        {g.tasks.map((task) => (
                          <View key={task.task} style={s.closedLine} testID={`team-closed-${task.task}`}>
                            <Text style={s.closedMain} numberOfLines={1}>
                              <Text style={s.id}>#{shortTask(task.task)}</Text> {task.title}
                            </Text>
                            <Text style={s.closedWhen} numberOfLines={1}>
                              {t.status(task.status)} {when(task.updated, now)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  : null}
              </View>
            ) : null}
          </SafeAreaView>
        </ScrollView>
      ) : null}
    </TallSheet>
  );
}

/** One agent: the row that opens it, the tasks it holds, and the one line it gets when it holds none. */
function AgentBlock({
  a,
  tasks,
  last,
  t,
  now,
  shown,
  onOpenAgent,
  onFlip,
}: {
  a: TeamAgent;
  tasks: TeamTask[];
  last: TeamTask | null;
  t: TeamStrings;
  now: number;
  shown: ReadonlySet<string>;
  onOpenAgent: (key: string) => void;
  onFlip: (id: string) => void;
}) {
  const pct = pctOf(a);
  const tone = barTone(pct);
  return (
    <View style={[s.agent, a.level > 1 && s.indent]} testID={`team-agent-block-${a.agent}`}>
      <Pressable
        onPress={() => onOpenAgent(a.agent)}
        accessibilityRole="button"
        accessibilityHint={a.directory || a.computer || ''}
        style={s.agentRow}
        testID={`team-agent-${a.agent}`}
      >
        <AgentDot state={a.state} testID={`team-dot-${a.agent}`} />
        <Text style={s.name} numberOfLines={1}>
          {a.name}
        </Text>
        {pct != null ? (
          <View style={s.ctx} testID={`team-ctx-${a.agent}`}>
            <View style={s.bar}>
              <View
                style={[
                  s.barFill,
                  { width: `${Math.max(0, Math.min(100, pct))}%` },
                  tone === 'warn' ? s.barWarn : tone === 'bad' ? s.barBad : null,
                ]}
                testID={`team-bar-${a.agent}`}
              />
            </View>
            <Text style={[s.pct, tone === 'warn' ? s.warnText : tone === 'bad' ? s.badText : null]}>{pct}%</Text>
          </View>
        ) : null}
      </Pressable>
      {tasks.map((task) => (
        <TaskBlock
          key={task.task}
          task={task}
          t={t}
          now={now}
          open={shown.has(task.task)}
          onFlip={() => onFlip(task.task)}
        />
      ))}
      {!tasks.length ? (
        <Text style={s.idleLine} numberOfLines={1} testID={`team-idle-${a.agent}`}>
          {idleLine(a.state, last, t, now)}
        </Text>
      ) : null}
    </View>
  );
}

/** One task under its agent: the number and its title, state and time at the right, the agent's word under. */
function TaskBlock({
  task,
  t,
  now,
  open,
  onFlip,
}: {
  task: TeamTask;
  t: TeamStrings;
  now: number;
  open: boolean;
  onFlip: () => void;
}) {
  const line = reportLine(task, t);
  const reports = task.reports || [];
  const last = reports.length ? reports[reports.length - 1] : null;
  return (
    <View style={s.task} testID={`team-task-${task.task}`}>
      <Pressable
        onPress={onFlip}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={s.taskRow}
        testID={`team-task-row-${task.task}`}
      >
        <Text style={[s.taskMain, open && s.taskMainOpen]} numberOfLines={2} testID={`team-task-main-${task.task}`}>
          <Text style={s.id}>#{shortTask(task.task)}</Text> {task.title}
        </Text>
        <Text style={s.taskWhen} numberOfLines={1}>
          {t.status(task.status)} · {took(task, now)}
        </Text>
      </Pressable>
      {line ? (
        <Pressable
          onPress={onFlip}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={line}
          testID={`team-note-${task.task}`}
        >
          <Text style={s.note} numberOfLines={1} testID={`team-note-text-${task.task}`}>
            {line}
          </Text>
        </Pressable>
      ) : null}
      {open && (last || task.answer) ? (
        <View style={s.detail} testID={`team-answer-${task.task}`}>
          {last ? <Text style={s.detailText}>{oneLine(last.summary)}</Text> : null}
          {task.answer ? (
            <Text style={[s.answer, last ? s.answerGap : null]}>{oneLine(task.answer)}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The state dot: working in the good green and breathing, waiting amber, interrupted/failed the error, idle a
 *  hollow ring. */
function AgentDot({ state, testID }: { state: string; testID: string }) {
  const tone = dotTone(state);
  if (tone === 'ok') return <StateDot s="done" pulse testID={testID} />;
  if (tone === 'warn') return <View style={[s.dot, s.dotWarn]} testID={testID} aria-hidden />;
  if (tone === 'bad') return <View style={[s.dot, s.dotBad]} testID={testID} aria-hidden />;
  return <View style={[s.dot, s.dotIdle]} testID={testID} aria-hidden />;
}

const s = StyleSheet.create({
  scroll: { paddingBottom: space.xl },
  wrap: { paddingHorizontal: gutter },
  center: { paddingVertical: space.xl, alignItems: 'center' },
  err: { paddingHorizontal: gutter, paddingVertical: space.xs, gap: space.xs },
  retry: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.ink },
  counts: { flexDirection: 'row', paddingTop: 1, paddingBottom: 5 },
  countsText: { flex: 1, fontFamily: fonts.sans, fontSize: 10.5, color: colors.inkDim, textAlign: 'right' },
  agent: { paddingTop: 2, paddingBottom: 6 },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    paddingVertical: 3,
    minHeight: 26,
  },
  indent: { paddingLeft: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  dotWarn: { backgroundColor: colors.warn },
  dotBad: { backgroundColor: colors.danger },
  dotIdle: { borderWidth: 1, borderColor: colors.line },
  name: { flexShrink: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  ctx: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  bar: { width: 36, height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: colors.inkDim },
  barWarn: { backgroundColor: colors.warn },
  barBad: { backgroundColor: colors.danger },
  pct: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim },
  warnText: { color: colors.warn },
  badText: { color: colors.danger },
  task: { paddingBottom: 1 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 1,
    paddingLeft: 12,
  },
  taskMain: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 15.5,
    color: colors.ink,
  },
  taskMainOpen: { color: colors.inkBright },
  id: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim },
  taskWhen: { flexShrink: 0, fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim },
  note: {
    paddingLeft: 12,
    paddingBottom: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14.5,
    color: colors.inkDim,
  },
  detail: { paddingLeft: 12, paddingTop: 3, paddingBottom: 5, gap: 1 },
  detailText: { fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 14.5, color: colors.inkDim },
  answer: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, color: colors.ink },
  answerGap: { marginTop: 2 },
  idleLine: {
    paddingLeft: 12,
    paddingBottom: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14.5,
    color: colors.inkDim,
  },
  dim: { fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 15, color: colors.inkDim, paddingVertical: 3 },
  closedBox: { marginTop: 4 },
  closedHead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, minHeight: 24 },
  closedAgent: {
    paddingLeft: 10,
    paddingTop: 4,
    paddingBottom: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkDim,
  },
  closedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 20,
    paddingBottom: 1,
  },
  closedMain: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 14.5, color: colors.inkDim },
  closedWhen: { flexShrink: 0, fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim },
});
