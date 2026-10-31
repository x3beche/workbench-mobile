/**
 * A manager session's Team, as the web app's right-hand column draws it (frontend/src/app/rooms/team-panel.ts)
 * in a sheet that rises from the bottom: the agents the session has under it - a name, a state dot, how much of
 * its window it uses and the task it holds - and the tasks it gave them, the open ones first with their answer
 * under a tap, the closed ones folded. One answer carries it all (GET /api/agents/team/{manager}); it is read
 * when the bus says the agents changed and every fifteen seconds while the sheet is open. Nothing here writes:
 * the work is given in the conversation, this only says how it is going.
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
  closedTasks,
  openCount,
  openTasks,
  pctOf,
  shortTask,
  teamTone,
  took,
  when,
  type TeamTone,
} from '../lib/team';
import type { TeamStrings } from '../lib/teamStrings';
import { colors, fonts, gutter, space, type } from '../theme/tokens';
import { ChevronDown, ChevronRight } from './icons';
import { Markdown } from './Markdown';
import { TallSheet } from './TallSheet';
import { ErrorText, Glyph } from './ui';

/** While the sheet is open, its team is read this often: a task's state changes without a word on the bus. */
const REFRESH_MS = 15_000;

const TONE: Record<TeamTone, string> = {
  live: colors.accent,
  warn: colors.warn,
  bad: colors.danger,
  ok: colors.ok,
  idle: colors.pressed,
};

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
  /** The tasks whose answer is open, and whether the closed ones are shown. */
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
  const agentOf = (task: TeamTask): TeamAgent | null => data?.agents.find((a) => a.agent === task.agent) ?? null;
  /** The task an agent is on: the first open one it holds. */
  const heldBy = (a: TeamAgent): TeamTask | null => open.find((x) => x.agent === a.agent) ?? null;

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
            <View style={s.sec} testID="team-agents">
              <View style={s.head}>
                <Text style={s.headText}>{t.agents}</Text>
                <Text style={s.fig} testID="team-agents-count">
                  {data.agents.length}
                </Text>
              </View>
              {data.agents.length ? (
                data.agents.map((a) => {
                  const pct = pctOf(a);
                  const n = openCount(a);
                  const task = heldBy(a);
                  return (
                    <Pressable
                      key={a.agent}
                      onPress={() => onOpenAgent(a.agent)}
                      accessibilityRole="button"
                      accessibilityHint={a.directory || a.computer || ''}
                      style={[s.row, a.level > 1 && s.indent]}
                      testID={`team-agent-${a.agent}`}
                    >
                      <View style={s.top}>
                        <View style={[s.dot, { backgroundColor: TONE[teamTone(a.state)] }]} aria-hidden />
                        <Text style={s.name} numberOfLines={1}>
                          {a.name}
                        </Text>
                        {pct != null ? <Text style={s.fig}>{pct}%</Text> : null}
                      </View>
                      <Text style={s.snip} numberOfLines={1}>
                        {n ? t.open(n) : t.idle}
                        {task ? ` · #${shortTask(task.task)} ${task.title}` : ''}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={s.dim} testID="team-empty-agent">
                  {t.none}
                </Text>
              )}
            </View>

            <View style={s.sec} testID="team-tasks">
              <View style={s.head}>
                <Text style={s.headText}>{t.tasks}</Text>
                <Text style={s.fig} testID="team-tasks-count">
                  {open.length}
                </Text>
              </View>
              {open.length ? (
                open.map((task) => (
                  <TaskRow
                    key={task.task}
                    task={task}
                    t={t}
                    now={now}
                    agentName={agentOf(task)?.name || task.agent_name}
                    open={shown.has(task.task)}
                    onPress={() => flip(task.task)}
                  />
                ))
              ) : (
                <Text style={s.dim} testID="team-empty-task">
                  {t.noTasks}
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
                    ? closed.map((task) => (
                        <TaskRow
                          key={task.task}
                          task={task}
                          t={t}
                          now={now}
                          agentName={agentOf(task)?.name || task.agent_name}
                          quiet
                          open={shown.has(task.task)}
                          onPress={() => flip(task.task)}
                        />
                      ))
                    : null}
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </ScrollView>
      ) : null}
    </TallSheet>
  );
}

function TaskRow({
  task,
  t,
  now,
  agentName,
  quiet = false,
  open,
  onPress,
}: {
  task: TeamTask;
  t: TeamStrings;
  now: number;
  agentName: string;
  /** A closed task: no state dot, and what became of it in the line under. */
  quiet?: boolean;
  open: boolean;
  onPress: () => void;
}) {
  const outcome = [agentName, t.status(task.status), task.outcome || ''].filter(Boolean).join(' · ');
  return (
    <View style={s.task} testID={`team-task-${task.task}`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={s.row}
        testID={`team-task-row-${task.task}`}
      >
        <View style={s.top}>
          {quiet ? null : <View style={[s.dot, { backgroundColor: TONE[teamTone(task.status)] }]} aria-hidden />}
          <Text style={s.id}>#{shortTask(task.task)}</Text>
          <Text style={s.title} numberOfLines={1}>
            {task.title}
          </Text>
          <Text style={s.when}>{when(task.updated, now)}</Text>
        </View>
        <Text style={s.snip} numberOfLines={1}>
          {quiet ? outcome : `${outcome} · ${took(task.created, task.updated)}`}
        </Text>
      </Pressable>
      {open ? (
        task.answer ? (
          <View style={s.answer} testID={`team-answer-${task.task}`}>
            <Markdown text={task.answer} />
          </View>
        ) : (
          <Text style={[s.snip, s.answerPad]} testID={`team-no-answer-${task.task}`}>
            {t.noAnswer}
          </Text>
        )
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: space.xl },
  wrap: { paddingHorizontal: gutter },
  center: { paddingVertical: space.xl, alignItems: 'center' },
  err: { paddingHorizontal: gutter, paddingVertical: space.xs, gap: space.xs },
  retry: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.ink },
  sec: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingBottom: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 7, paddingBottom: 4 },
  headText: {
    flex: 1,
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  fig: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim, textAlign: 'right' },
  row: { paddingVertical: 4, paddingBottom: 5 },
  indent: { paddingLeft: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  name: { flexShrink: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  id: { flexShrink: 0, fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  when: { flexShrink: 0, fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkDim },
  snip: { fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 15, color: colors.inkDim, marginTop: 1 },
  dim: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim, paddingVertical: 3 },
  answer: { paddingBottom: 6, paddingTop: 2 },
  answerPad: { paddingBottom: 4 },
  closedBox: { marginTop: 2 },
  closedHead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, minHeight: 24 },
  task: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
