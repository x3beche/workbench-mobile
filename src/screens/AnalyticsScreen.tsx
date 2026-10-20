/**
 * Analytics: what the web app's Chat shows bottom left (the Models card - the
 * last 14 days' tokens by provider, this month and today - and the Tools card
 * - this week's tool use), with what follows it overall: money and requests
 * over 30 days by provider and model (Settings > Agent & LLM on the web), the
 * Orchestrator (its state, its sub-agents now, the incidents the supervisor
 * kept), the job pool (one's own jobs and how full the server is; for the
 * owner and the admins the latest finished with their wait and run times),
 * and, for them, the sandboxes. Each card reads the route the web app
 * reads, and leaves itself out when the server has none of it or the account
 * may not see it.
 *
 * Drawn as the web Chat's Models and Tools cards (rooms/cc-usage.ts): a
 * bordered card on the theme's ground - its icon, title and period in a
 * head row, one large figure with its unit and a second at the right, a
 * fine chart, a caption - grouped under small uppercase group labels (LLM,
 * Agents, Work, Tools, Server) as the Chat list's "ROOMS" and "PINNED".
 * Two cards a row where they fit, one on a narrow phone; a card with more
 * rows than it shows opens to all of them.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WorkbenchClient } from '../api/client';
import type {
  AdminPool,
  AdminSandboxes,
  AgentTree,
  Incident,
  LlmSummary,
  LlmUsage,
  MyPool,
  OrchStatus,
  ToolsUsage,
} from '../api/types';
import { Bars, Columns, Legend, SERIES } from '../components/Charts';
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Cpu,
  Layers,
  ListOrdered,
  Menu,
  Network,
  RotateCcw,
  SquareTerminal,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from '../components/icons';
import { modelName } from '../components/MessageItem';
import { StateDot } from '../components/StateDot';
import { Glyph, IconButton } from '../components/ui';
import { compact, dayLabel, money, seconds } from '../lib/numbers';
import { failureWord, stateWord, statusDot, whenOf } from '../lib/orchestrator';
import type { OrchStrings } from '../lib/orchStrings';
import type { SettingsStrings } from '../lib/settingsStrings';
import { colors, fonts, gutter, space, type } from '../theme/tokens';

interface Data {
  summary?: LlmSummary | null;
  usage?: LlmUsage | null;
  tools?: ToolsUsage | null;
  orch?: OrchStatus | null;
  tree?: AgentTree | null;
  incidents?: Incident[] | null;
  pool?: MyPool | null;
  adminPool?: AdminPool | null;
  sandboxes?: AdminSandboxes | null;
}

/** null when the route is not there or may not be read: that section is left out. */
const soft = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

export function AnalyticsScreen({
  client,
  t,
  ot,
  lang,
  admin = false,
  wide = false,
  onMenu,
}: {
  client: WorkbenchClient | null;
  t: SettingsStrings;
  ot: OrchStrings;
  lang: 'en' | 'tr';
  /** The owner or an admin: the server's pool and the sandboxes too. */
  admin?: boolean;
  wide?: boolean;
  onMenu?: () => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async (): Promise<Data | null> => {
    if (!client) return null;
    const [summary, usage, tools, orch, incidents, pool, adminPool, sandboxes] = await Promise.all([
      soft(client.llmSummary(14)),
      soft(client.llmUsage(30)),
      soft(client.toolsUsage('week')),
      soft(client.orchestrator()),
      soft(client.orchestratorIncidents().then((r) => r.incidents)),
      soft(client.myPool()),
      admin ? soft(client.adminPool()) : Promise.resolve(null),
      admin ? soft(client.adminSandboxes()) : Promise.resolve(null),
    ]);
    const tree = orch && (orch.desired === 'running' || orch.session) ? await soft(client.orchestratorTree()) : null;
    return { summary, usage, tools, orch, tree, incidents, pool, adminPool, sandboxes };
  }, [client, admin]);

  useEffect(() => {
    let live = true;
    fetchAll().then((got) => live && got && setData(got));
    return () => {
      live = false;
    };
  }, [fetchAll]);

  const load = () => {
    setBusy(true);
    fetchAll().then((got) => {
      if (got) setData(got);
      setBusy(false);
    });
  };

  const [width, setWidth] = useState(0);
  const cols = width >= 560 ? 2 : 1;
  const d = data;
  const admin_ = !!(d?.adminPool || d?.sandboxes);
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="analytics-screen">
      <View style={s.head}>
        {!wide && onMenu ? (
          <IconButton icon={Menu} label="Open the conversations" onPress={onMenu} testID="analytics-open-drawer" />
        ) : (
          <View style={s.headPad} />
        )}
        <Text style={s.title} accessibilityRole="header">
          {t.analytics}
        </Text>
        <IconButton icon={RotateCcw} label={t.refresh} onPress={load} color={colors.inkDim} testID="analytics-refresh" />
      </View>
      {!d ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.inkDim} />
        </View>
      ) : (
        <ScrollView
          indicatorStyle="white"
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.inkDim} colors={[colors.ink]} />}
        >
          {d.summary || d.usage ? (
            <Group title={t.groups.llm} cols={cols} testID="group-llm">
              {d.summary ? <ModelsCard sum={d.summary} t={t} /> : null}
              {d.usage ? <SpendCard u={d.usage} t={t} lang={lang} /> : null}
              {d.usage?.by_provider.length ? <ProvidersCard u={d.usage} t={t} /> : null}
              {d.usage?.by_model.length ? <ModelsByCallsCard u={d.usage} t={t} /> : null}
            </Group>
          ) : null}
          {d.orch ? (
            <Group title={t.groups.agents} cols={cols} testID="group-agents">
              <OrchCard st={d.orch} tree={d.tree ?? null} t={t} ot={ot} lang={lang} />
              <IncidentsCard incidents={d.incidents ?? []} t={t} ot={ot} lang={lang} />
            </Group>
          ) : null}
          {d.pool ? (
            <Group title={t.groups.work} cols={cols} testID="group-work">
              <PoolCard pool={d.pool} t={t} />
              <MyJobsCard pool={d.pool} t={t} />
            </Group>
          ) : null}
          {d.tools ? (
            <Group title={t.groups.tools} cols={cols} testID="group-tools">
              <ToolsCard u={d.tools} t={t} lang={lang} />
              <TopToolsCard u={d.tools} t={t} />
            </Group>
          ) : null}
          {admin_ ? (
            <Group title={t.groups.server} cols={cols} testID="group-server">
              {d.sandboxes ? <SandboxCard sb={d.sandboxes} t={t} lang={lang} /> : null}
              {d.adminPool ? <FinishedCard all={d.adminPool} t={t} /> : null}
            </Group>
          ) : null}
          {!d.summary && !d.usage && !d.tools && !d.orch && !d.pool ? <Text style={s.none}>{t.cannotRead}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** A group: its label small and uppercase at the top left, its cards two a row where they fit. */
function Group({ title, cols, children, testID }: { title: string; cols: number; children: ReactNode; testID?: string }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean) as ReactNode[];
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={s.group} testID={testID}>
      <Text style={s.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      {rows.map((r, i) => (
        <View key={i} style={s.cardRow}>
          {r.map((c, j) => (
            <View key={j} style={s.cardCell}>
              {c}
            </View>
          ))}
          {r.length < cols ? <View style={s.cardCell} /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * One card, as the web's: icon, title and period in the head (a chevron when
 * it opens to more), the figure large in mono with its unit and a second
 * figure at the right, the chart, a caption.
 */
function Card({
  icon,
  title,
  period,
  big,
  unit,
  right,
  chart,
  caption,
  more,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  period?: string;
  big?: string;
  unit?: string;
  right?: ReactNode;
  chart?: ReactNode;
  caption?: ReactNode;
  /** What it shows when opened. */
  more?: ReactNode;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <View style={s.cHead}>
        <Glyph icon={icon} size={14} color={colors.inkDim} />
        <Text style={s.cTitle} numberOfLines={1}>
          {title}
        </Text>
        {period ? (
          <Text style={s.cPeriod} numberOfLines={1}>
            {period}
          </Text>
        ) : (
          <View style={s.flex} />
        )}
        {more ? <Glyph icon={open ? ChevronDown : ChevronRight} size={13} color={colors.inkDim} /> : null}
      </View>
      {big != null || right ? (
        <View style={s.cFig}>
          {big != null ? <Text style={s.cBig}>{big}</Text> : null}
          {unit ? <Text style={s.cUnit}>{unit}</Text> : null}
          <View style={s.flex} />
          {typeof right === 'string' ? (
            <Text style={s.cRight} numberOfLines={1}>
              {right}
            </Text>
          ) : (
            right
          )}
        </View>
      ) : null}
      {chart ? <View style={s.cChart}>{chart}</View> : null}
      {caption ? (
        typeof caption === 'string' ? (
          <Text style={s.cSub} numberOfLines={2}>
            {caption}
          </Text>
        ) : (
          caption
        )
      ) : null}
      {open && more ? <View style={s.cMore}>{more}</View> : null}
    </>
  );
  return more ? (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      testID={testID}
    >
      {body}
    </Pressable>
  ) : (
    <View style={s.card} testID={testID}>
      {body}
    </View>
  );
}

const color = (i: number) => SERIES[i % SERIES.length];

function ModelsCard({ sum, t }: { sum: LlmSummary; t: SettingsStrings }) {
  const provs = sum.providers?.length
    ? sum.providers
    : [...new Set(sum.by_day.flatMap((x) => Object.keys(x.by ?? {})))].map((id) => ({ id, name: id }));
  const cols = sum.by_day.map((x) => ({
    label: x.day,
    parts: provs.length ? provs.map((p, i) => ({ value: x.by?.[p.id] ?? 0, color: color(i) })) : [{ value: x.tokens, color: SERIES[0] }],
  }));
  const used = provs.filter((p) => sum.by_day.some((x) => (x.by?.[p.id] ?? 0) > 0));
  return (
    <Card
      icon={Cpu}
      title={t.models}
      period={t.period.month}
      big={compact(sum.month.tokens)}
      unit="tok"
      right={`${compact(sum.month.calls)} ${t.calls}`}
      chart={<Columns data={cols} height={40} bare format={compact} testID="models-chart" />}
      caption={`${t.today} ${compact(sum.today.tokens)} tok · ${sum.today.answers} ${t.answers}${sum.month.cost_usd != null ? ` · ${t.thisMonth.toLowerCase()} ${money(sum.month.cost_usd)}` : ''}`}
      more={
        <>
          {used.length > 1 ? <Legend items={used.map((p) => ({ label: p.name, color: color(provs.indexOf(p)) }))} /> : null}
          {sum.answers.tps_median != null ? (
            <Text style={s.cSub}>{t.speed(sum.answers.tps_median.toFixed(0), seconds((sum.answers.ttft_ms_median ?? 0) / 1000))}</Text>
          ) : null}
        </>
      }
      testID="analytics-models"
    />
  );
}

function SpendCard({ u, t, lang }: { u: LlmUsage; t: SettingsStrings; lang: 'en' | 'tr' }) {
  const n = u.cost.n;
  const day = (i: number) => new Date((u.cost.t0 + i * u.cost.step) * 1000).toISOString().slice(0, 10);
  const models = u.cost.series.filter((x) => x.values.some((v) => (v ?? 0) > 0)).slice(0, SERIES.length);
  const cols = Array.from({ length: n }, (_, i) => ({
    label: dayLabel(day(i), lang),
    parts: models.map((m, j) => ({ value: m.values[i] ?? 0, color: color(j) })),
  }));
  return (
    <Card
      icon={Coins}
      title={t.spend}
      period={t.period.days30}
      big={u.totals.cost_usd != null ? money(u.totals.cost_usd) : '-'}
      right={`${compact(u.totals.calls)} ${t.calls}`}
      chart={<Columns data={cols} height={40} bare format={money} testID="spend-chart" />}
      caption={u.totals.unpriced_calls ? t.unpriced(u.totals.unpriced_calls) : `${compact(u.totals.input + u.totals.output)} tok`}
      more={models.length ? <Legend items={models.map((m, j) => ({ label: modelName(m.name), color: color(j) }))} /> : undefined}
      testID="analytics-spend"
    />
  );
}

/** A card of rows with hairline bars: the first few, all of them when opened. */
function RowsCard({
  icon,
  title,
  period,
  big,
  unit,
  right,
  rows,
  first = 4,
  empty,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  period?: string;
  big?: string;
  unit?: string;
  right?: string;
  rows: { label: string; value: number; text: string; color?: string }[];
  first?: number;
  empty?: string;
  testID?: string;
}) {
  return (
    <Card
      icon={icon}
      title={title}
      period={period}
      big={big}
      unit={unit}
      right={right}
      chart={rows.length ? <Bars rows={rows.slice(0, first)} /> : <Text style={s.cSub}>{empty}</Text>}
      more={rows.length > first ? <Bars rows={rows.slice(first)} /> : undefined}
      testID={testID}
    />
  );
}

function ProvidersCard({ u, t }: { u: LlmUsage; t: SettingsStrings }) {
  return (
    <RowsCard
      icon={Layers}
      title={t.byProvider}
      period={t.period.days30}
      rows={u.by_provider.map((p, i) => ({
        label: p.name,
        value: p.calls,
        text: `${compact(p.calls)} · ${compact(p.input + p.output)} tok${p.cost_usd != null ? ` · ${money(p.cost_usd)}` : ''}`,
        color: color(i),
      }))}
      testID="analytics-providers"
    />
  );
}

function ModelsByCallsCard({ u, t }: { u: LlmUsage; t: SettingsStrings }) {
  return (
    <RowsCard
      icon={Cpu}
      title={t.byModel}
      period={t.period.days30}
      rows={u.by_model.map((m) => ({
        label: modelName(m.name),
        value: m.calls,
        text: `${compact(m.calls)}${m.cost_usd != null ? ` · ${money(m.cost_usd)}` : ''}`,
      }))}
      testID="spend-models"
    />
  );
}

function OrchCard({
  st,
  tree,
  t,
  ot,
  lang,
}: {
  st: OrchStatus;
  tree: AgentTree | null;
  t: SettingsStrings;
  ot: OrchStrings;
  lang: 'en' | 'tr';
}) {
  const subs = tree ? tree.nodes.filter((n) => n.parentID) : [];
  const busy = subs.filter((n) => n.state === 'running' || n.state === 'retry').length;
  return (
    <Card
      icon={Network}
      title={t.orchestrator}
      period={t.period.now}
      right={
        <View style={s.cState}>
          <StateDot s={statusDot(st)} />
          <Text style={s.cRight}>{stateWord(st, ot)}</Text>
        </View>
      }
      big={String(subs.length)}
      unit={t.subAgents(subs.length).replace(/^\d+\s*/, '')}
      chart={
        subs.length ? (
          <Bars
            rows={[
              { label: ot.working, value: busy, text: String(busy), color: SERIES[0] },
              { label: ot.done, value: subs.length - busy, text: String(subs.length - busy), color: SERIES[2] },
            ]}
          />
        ) : undefined
      }
      caption={`${st.model ? modelName(st.model) : ''}${st.started_at && st.state === 'running' ? ` · ${ot.since} ${whenOf(st.started_at, lang)}` : ''}`}
      testID="analytics-orchestrator"
    />
  );
}

function IncidentsCard({ incidents, t, ot, lang }: { incidents: Incident[]; t: SettingsStrings; ot: OrchStrings; lang: 'en' | 'tr' }) {
  const kinds = incidents.reduce<Record<string, number>>((a, i) => ({ ...a, [i.kind]: (a[i.kind] ?? 0) + 1 }), {});
  return (
    <Card
      icon={TriangleAlert}
      title={t.incidents}
      period={t.period.latest}
      big={String(incidents.length)}
      chart={
        incidents.length ? (
          <Bars
            rows={Object.entries(kinds).map(([k, n], i) => ({
              label: failureWord(k, ot),
              value: n,
              text: String(n),
              color: k === 'auth' || k === 'credit' ? colors.warn : color(i + 4),
            }))}
          />
        ) : undefined
      }
      caption={incidents.length ? undefined : t.noIncidents}
      more={
        incidents.length ? (
          <View style={s.lines}>
            {incidents.slice(0, 10).map((i) => (
              <Text key={i.id} style={s.line} numberOfLines={2}>
                <Text style={s.dim}>{whenOf(i.at, lang)} </Text>
                {failureWord(i.kind, ot)}
                {i.detail ? <Text style={s.dim}>{` · ${i.detail}`}</Text> : null}
              </Text>
            ))}
          </View>
        ) : undefined
      }
      testID="analytics-incidents"
    />
  );
}

function PoolCard({ pool, t }: { pool: MyPool; t: SettingsStrings }) {
  return (
    <RowsCard
      icon={ListOrdered}
      title={t.pool}
      period={t.period.now}
      big={`${pool.running}/${pool.limits.total}`}
      unit={t.running}
      right={t.waiting(pool.queued)}
      rows={Object.entries(pool.limits.kinds).map(([k, v], i) => ({
        label: k,
        value: v.running + v.queued,
        text: `${v.running}/${v.limit}${v.queued ? ` · +${v.queued}` : ''}`,
        color: color(i),
      }))}
      testID="analytics-pool"
    />
  );
}

function MyJobsCard({ pool, t }: { pool: MyPool; t: SettingsStrings }) {
  return (
    <RowsCard
      icon={Layers}
      title={t.yourJobs}
      period={t.period.now}
      big={String(pool.jobs.length)}
      rows={pool.jobs.map((j) => ({
        label: `${j.label || j.kind} · ${j.state}`,
        value: (j.waited_s ?? 0) + (j.ran_s ?? 0),
        text: `${t.waited} ${seconds(j.waited_s ?? 0)}${j.ran_s != null ? ` · ${t.ran} ${seconds(j.ran_s)}` : ''}`,
        color: j.state === 'running' ? SERIES[2] : colors.warn,
      }))}
      empty={t.noJobs}
      testID="analytics-myjobs"
    />
  );
}

function ToolsCard({ u, t, lang }: { u: ToolsUsage; t: SettingsStrings; lang: 'en' | 'tr' }) {
  const ranked = Object.entries(u.tools)
    .filter(([, v]) => v.week > 0)
    .sort((a, b) => b[1].week - a[1].week);
  const top = ranked.slice(0, SERIES.length - 1).map(([k]) => k);
  const cols = u.days.map((x) => {
    const rest = Object.entries(x.by)
      .filter(([k]) => !top.includes(k))
      .reduce((a, [, v]) => a + v, 0);
    return {
      label: dayLabel(x.day, lang),
      parts: [...top.map((k, i) => ({ value: x.by[k] ?? 0, color: color(i) })), { value: rest, color: SERIES[7] }],
    };
  });
  const total = ranked.reduce((a, [, v]) => a + v.week, 0);
  const done = ranked.reduce((a, [, v]) => a + (v.week_done ?? v.week), 0);
  return (
    <Card
      icon={Wrench}
      title={t.tools}
      period={t.period.week}
      big={String(total)}
      unit={t.uses(total).replace(/^\d+\s*/, '')}
      right={t.worked(done)}
      chart={total ? <Columns data={cols} height={40} bare testID="tools-chart" /> : undefined}
      caption={ranked[0] ? `${ranked[0][0].replace(/_/g, ' ')} · ${t.uses(ranked[0][1].week)}` : t.nothing}
      testID="analytics-tools"
    />
  );
}

function TopToolsCard({ u, t }: { u: ToolsUsage; t: SettingsStrings }) {
  const ranked = Object.entries(u.tools)
    .filter(([, v]) => v.week > 0)
    .sort((a, b) => b[1].week - a[1].week);
  return (
    <RowsCard
      icon={Wrench}
      title={t.toolsAbout.split(',')[0]}
      period={t.period.week}
      rows={ranked.map(([k, v], i) => ({
        label: k.replace(/_/g, ' '),
        value: v.week,
        text: `${v.week}${v.week_done != null ? ` · ${t.worked(v.week_done)}` : ''}`,
        color: color(Math.min(i, 7)),
      }))}
      empty={t.nothing}
      testID="analytics-toptools"
    />
  );
}

function SandboxCard({ sb, t, lang }: { sb: AdminSandboxes; t: SettingsStrings; lang: 'en' | 'tr' }) {
  const rows = [...sb.sandboxes].sort((a, b) => (b.usage?.mem_mb ?? 0) - (a.usage?.mem_mb ?? 0));
  return (
    <RowsCard
      icon={SquareTerminal}
      title={t.sandboxes}
      period={t.period.now}
      big={`${sb.running}/${sb.max_running}`}
      unit={t.running}
      rows={rows.map((r) => ({
        label: `${r.name || r.email || r.id}${r.env_name ? ` · ${r.env_name}` : ''}`,
        value: r.usage?.mem_mb ?? 0,
        text: `${r.state} · ${compact(r.usage?.mem_mb ?? 0)} MB${r.last_active ? ` · ${whenOf(r.last_active, lang)}` : ''}`,
        color: r.state === 'running' ? SERIES[2] : r.state === 'error' ? colors.danger : SERIES[7],
      }))}
      empty={t.nothing}
      testID="analytics-sandboxes"
    />
  );
}

function FinishedCard({ all, t }: { all: AdminPool; t: SettingsStrings }) {
  const recent = all.recent.filter((r) => r.waited_s != null || r.ran_s != null);
  const avgWait = recent.length ? recent.reduce((a, r) => a + (r.waited_s ?? 0), 0) / recent.length : 0;
  return (
    <RowsCard
      icon={ListOrdered}
      title={t.recentJobs}
      period={t.period.latest}
      big={seconds(avgWait)}
      unit={t.waited}
      right={String(recent.length)}
      rows={recent.map((r) => ({
        label: `${r.label || r.kind}${r.who?.name ? ` · ${r.who.name}` : ''}`,
        value: (r.waited_s ?? 0) + (r.ran_s ?? 0),
        text: `${seconds(r.waited_s ?? 0)} · ${seconds(r.ran_s ?? 0)}`,
        color: (r.waited_s ?? 0) > (r.ran_s ?? 0) ? colors.warn : SERIES[2],
      }))}
      empty={t.nothing}
      testID="analytics-finished"
    />
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  head: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headPad: { width: space.sm },
  title: { flex: 1, paddingHorizontal: 4, fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: gutter - 4, paddingBottom: space.xl },
  group: { gap: 8, paddingTop: space.md },
  // As the Chat list's "ROOMS" and "PINNED": small, uppercase, at the left.
  groupTitle: {
    paddingHorizontal: 2,
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.inkDim,
  },
  cardRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  cardCell: { flex: 1, minWidth: 0 },
  // The web's .ccl-card / .ccl: a 1 px hairline, the theme's ground, a small radius, compact padding.
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    flexGrow: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
    gap: 6,
  },
  cardPressed: { backgroundColor: colors.hover },
  cHead: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  cTitle: { flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  cPeriod: { flex: 1, textAlign: 'right', fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkDim },
  cFig: { flexDirection: 'row', alignItems: 'baseline', gap: 5, minWidth: 0 },
  cBig: { fontFamily: fonts.monoSemi, fontSize: 20, color: colors.ink },
  cUnit: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkDim },
  cRight: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkDim },
  cState: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cChart: { marginTop: 2 },
  cSub: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, color: colors.inkDim },
  cMore: { gap: 8, paddingTop: 6, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.line },
  lines: { gap: 4 },
  line: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  dim: { color: colors.inkDim },
  none: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim, padding: gutter },
});
