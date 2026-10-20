/**
 * Analytics: what the web app's Chat shows bottom left (the Models card - the
 * last 14 days' tokens by provider, this month and today - and the Tools card
 * - this week's tool use), with what follows it overall: money and requests
 * over 30 days by provider and model (Settings > Agent & LLM on the web), the
 * Orchestrator (its state, its sub-agents now, the incidents the supervisor
 * kept), the job pool (one's own jobs and how full the server is; for the
 * owner and the admins the latest finished with their wait and run times),
 * and, for them, the sandboxes. Each section reads the route the web app
 * reads, and leaves itself out when the server has none of it or the account
 * may not see it. Full width, sections side by side on a wide screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Menu, RotateCcw } from '../components/icons';
import { modelName } from '../components/MessageItem';
import { StateDot } from '../components/StateDot';
import { IconButton } from '../components/ui';
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

  const d = data;
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
          contentContainerStyle={[s.body, wide && s.bodyWide]}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.inkDim} colors={[colors.ink]} />}
        >
          {d.summary ? <ModelsSection sum={d.summary} t={t} lang={lang} wide={wide} /> : null}
          {d.usage ? <SpendSection u={d.usage} t={t} lang={lang} wide={wide} /> : null}
          {d.tools ? <ToolsSection u={d.tools} t={t} lang={lang} wide={wide} /> : null}
          {d.orch ? (
            <OrchSection st={d.orch} tree={d.tree ?? null} incidents={d.incidents ?? []} t={t} ot={ot} lang={lang} wide={wide} />
          ) : null}
          {d.pool ? <PoolSection mine={d.pool} all={d.adminPool ?? null} t={t} lang={lang} wide={wide} /> : null}
          {d.sandboxes ? <SandboxSection sb={d.sandboxes} t={t} lang={lang} wide={wide} /> : null}
          {!d.summary && !d.usage && !d.tools && !d.orch && !d.pool ? <Text style={s.none}>{t.cannotRead}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({
  title,
  about,
  side,
  wide,
  children,
  testID,
}: {
  title: string;
  about?: string;
  side?: string;
  wide: boolean;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={[s.section, wide && s.sectionWide]} testID={testID}>
      <View style={s.secHead}>
        <Text style={s.secTitle}>{title}</Text>
        {side ? (
          <Text style={s.secSide} numberOfLines={1}>
            {side}
          </Text>
        ) : null}
      </View>
      {about ? <Text style={s.about}>{about}</Text> : null}
      {children}
    </View>
  );
}

/** A label and its figure, side by side on one line. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Text style={s.figure}>
      <Text style={s.figLabel}>{label} </Text>
      {value}
    </Text>
  );
}

function ModelsSection({ sum, t, lang, wide }: { sum: LlmSummary; t: SettingsStrings; lang: 'en' | 'tr'; wide: boolean }) {
  const provs = sum.providers?.length
    ? sum.providers
    : [...new Set(sum.by_day.flatMap((x) => Object.keys(x.by ?? {})))].map((id) => ({ id, name: id }));
  const color = (i: number) => SERIES[i % SERIES.length];
  const cols = sum.by_day.map((x) => ({
    label: dayLabel(x.day, lang),
    parts: provs.length
      ? provs.map((p, i) => ({ value: x.by?.[p.id] ?? 0, color: color(i) }))
      : [{ value: x.tokens, color: SERIES[0] }],
  }));
  const used = provs.filter((p) => sum.by_day.some((x) => (x.by?.[p.id] ?? 0) > 0));
  return (
    <Section title={t.models} about={t.modelsAbout} wide={wide} testID="analytics-models">
      <View style={s.figures}>
        <Figure label={t.thisMonth} value={`${compact(sum.month.tokens)} ${t.tokens} · ${compact(sum.month.calls)} ${t.calls}${sum.month.cost_usd != null ? ` · ${money(sum.month.cost_usd)}` : ''}`} />
        <Figure label={t.today} value={`${compact(sum.today.tokens)} ${t.tokens} · ${sum.today.answers} ${t.answers}`} />
      </View>
      <Columns data={cols} format={compact} testID="models-chart" />
      {used.length > 1 ? <Legend items={used.map((p) => ({ label: p.name, color: color(provs.indexOf(p)) }))} /> : null}
      {sum.answers.tps_median != null ? (
        <Text style={s.small}>
          {t.speed(sum.answers.tps_median.toFixed(0), seconds((sum.answers.ttft_ms_median ?? 0) / 1000))}
        </Text>
      ) : null}
    </Section>
  );
}

function SpendSection({ u, t, lang, wide }: { u: LlmUsage; t: SettingsStrings; lang: 'en' | 'tr'; wide: boolean }) {
  const n = u.cost.n;
  const day = (i: number) => new Date((u.cost.t0 + i * u.cost.step) * 1000).toISOString().slice(0, 10);
  const models = u.cost.series.filter((x) => x.values.some((v) => (v ?? 0) > 0));
  const cols = Array.from({ length: n }, (_, i) => ({
    label: dayLabel(day(i), lang),
    parts: models.slice(0, SERIES.length).map((m, j) => ({ value: m.values[i] ?? 0, color: SERIES[j] })),
  }));
  const usd = u.totals.cost_usd;
  return (
    <Section
      title={t.spend}
      about={t.spendAbout}
      side={usd != null ? money(usd) : undefined}
      wide={wide}
      testID="analytics-spend"
    >
      <Columns data={cols} format={money} testID="spend-chart" />
      {models.length > 1 ? (
        <Legend items={models.slice(0, SERIES.length).map((m, j) => ({ label: modelName(m.name), color: SERIES[j] }))} />
      ) : null}
      {u.totals.unpriced_calls ? <Text style={s.small}>{t.unpriced(u.totals.unpriced_calls)}</Text> : null}
      {u.by_provider.length ? (
        <>
          <Text style={s.sub}>{t.byProvider}</Text>
          <Bars
            rows={u.by_provider.map((p, i) => ({
              label: p.name,
              value: p.calls,
              text: `${compact(p.calls)} ${t.calls} · ${compact(p.input + p.output)} ${t.tokens}${p.cost_usd != null ? ` · ${money(p.cost_usd)}` : ''}`,
              color: SERIES[i % SERIES.length],
            }))}
          />
        </>
      ) : null}
      {u.by_model.length ? (
        <>
          <Text style={s.sub}>{t.byModel}</Text>
          <Bars
            rows={u.by_model.slice(0, 8).map((m) => ({
              label: modelName(m.name),
              value: m.calls,
              text: `${compact(m.calls)}${m.cost_usd != null ? ` · ${money(m.cost_usd)}` : ''}`,
            }))}
            testID="spend-models"
          />
        </>
      ) : null}
    </Section>
  );
}

function ToolsSection({ u, t, lang, wide }: { u: ToolsUsage; t: SettingsStrings; lang: 'en' | 'tr'; wide: boolean }) {
  const ranked = Object.entries(u.tools)
    .filter(([, v]) => v.week > 0)
    .sort((a, b) => b[1].week - a[1].week);
  const top = ranked.slice(0, SERIES.length - 1).map(([k]) => k);
  const color = (name: string) => SERIES[Math.max(0, top.indexOf(name))] ?? SERIES[7];
  const cols = u.days.map((x) => {
    const rest = Object.entries(x.by)
      .filter(([k]) => !top.includes(k))
      .reduce((a, [, v]) => a + v, 0);
    return {
      label: dayLabel(x.day, lang),
      parts: [...top.map((k) => ({ value: x.by[k] ?? 0, color: color(k) })), { value: rest, color: SERIES[7] }],
    };
  });
  const total = ranked.reduce((a, [, v]) => a + v.week, 0);
  return (
    <Section title={t.tools} about={t.toolsAbout} side={t.uses(total)} wide={wide} testID="analytics-tools">
      {total ? (
        <>
          <Columns data={cols} testID="tools-chart" />
          <Bars
            rows={ranked.slice(0, 8).map(([k, v]) => ({
              label: k.replace(/_/g, ' '),
              value: v.week,
              text: `${t.uses(v.week)}${v.week_done != null ? ` · ${t.worked(v.week_done)}` : ''}`,
              color: color(k),
            }))}
          />
        </>
      ) : (
        <Text style={s.none}>{t.nothing}</Text>
      )}
    </Section>
  );
}

function OrchSection({
  st,
  tree,
  incidents,
  t,
  ot,
  lang,
  wide,
}: {
  st: OrchStatus;
  tree: AgentTree | null;
  incidents: Incident[];
  t: SettingsStrings;
  ot: OrchStrings;
  lang: 'en' | 'tr';
  wide: boolean;
}) {
  const subs = tree ? tree.nodes.filter((n) => n.parentID).length : 0;
  const kinds = incidents.reduce<Record<string, number>>((a, i) => ({ ...a, [i.kind]: (a[i.kind] ?? 0) + 1 }), {});
  return (
    <Section title={t.orchestrator} about={t.orchestratorAbout} wide={wide} testID="analytics-orchestrator">
      <View style={s.stateRow}>
        <StateDot s={statusDot(st)} />
        <Text style={s.stateText}>
          {stateWord(st, ot)}
          {st.model ? <Text style={s.mono}>{`  ${modelName(st.model)}`}</Text> : null}
          {st.started_at && st.state === 'running' ? <Text style={s.dim}>{` · ${ot.since} ${whenOf(st.started_at, lang)}`}</Text> : null}
        </Text>
      </View>
      {tree ? <Text style={s.small}>{t.agentsNow(subs)}</Text> : null}
      <Text style={s.sub}>{t.incidents}</Text>
      {incidents.length ? (
        <>
          <Bars
            rows={Object.entries(kinds).map(([k, n], i) => ({
              label: failureWord(k, ot),
              value: n,
              text: String(n),
              color: k === 'auth' || k === 'credit' ? colors.warn : k === 'manual' ? SERIES[7] : SERIES[(i + 4) % 8],
            }))}
          />
          {incidents.slice(0, 5).map((i) => (
            <Text key={i.id} style={s.line} numberOfLines={1}>
              <Text style={s.dim}>{whenOf(i.at, lang)} </Text>
              {failureWord(i.kind, ot)}
              {i.detail ? <Text style={s.dim}>{` · ${i.detail}`}</Text> : null}
            </Text>
          ))}
        </>
      ) : (
        <Text style={s.small}>{t.noIncidents}</Text>
      )}
    </Section>
  );
}

function PoolSection({
  mine,
  all,
  t,
  lang,
  wide,
}: {
  mine: MyPool;
  all: AdminPool | null;
  t: SettingsStrings;
  lang: 'en' | 'tr';
  wide: boolean;
}) {
  const kinds = Object.entries(mine.limits.kinds);
  const recent = (all?.recent ?? []).filter((r) => r.waited_s != null || r.ran_s != null).slice(0, 10);
  return (
    <Section
      title={t.pool}
      about={t.poolAbout}
      side={t.serverLoad(mine.running, mine.queued, mine.limits.total)}
      wide={wide}
      testID="analytics-pool"
    >
      {kinds.length ? (
        <Bars
          rows={kinds.map(([k, v], i) => ({
            label: k,
            value: v.running + v.queued,
            text: `${v.running}/${v.limit}${v.queued ? ` · +${v.queued}` : ''}`,
            color: SERIES[i % SERIES.length],
          }))}
        />
      ) : null}
      <Text style={s.sub}>{t.yourJobs}</Text>
      {mine.jobs.length ? (
        mine.jobs.map((j) => (
          <Text key={j.job} style={s.line} numberOfLines={1}>
            {j.label || j.kind}
            <Text style={s.dim}>{` · ${j.state}${j.waited_s != null ? ` · ${t.waited} ${seconds(j.waited_s)}` : ''}`}</Text>
          </Text>
        ))
      ) : (
        <Text style={s.small}>{t.noJobs}</Text>
      )}
      {recent.length ? (
        <>
          <Text style={s.sub}>
            {t.recentJobs} <Text style={s.dim}>· {t.adminsOnly}</Text>
          </Text>
          <Bars
            rows={recent.map((r) => ({
              label: `${r.label || r.kind}${r.who?.name ? ` · ${r.who.name}` : ''}`,
              value: (r.waited_s ?? 0) + (r.ran_s ?? 0),
              text: `${t.waited} ${seconds(r.waited_s ?? 0)} · ${t.ran} ${seconds(r.ran_s ?? 0)}`,
              color: (r.waited_s ?? 0) > (r.ran_s ?? 0) ? colors.warn : SERIES[2],
            }))}
          />
        </>
      ) : null}
    </Section>
  );
}

function SandboxSection({ sb, t, lang, wide }: { sb: AdminSandboxes; t: SettingsStrings; lang: 'en' | 'tr'; wide: boolean }) {
  const rows = [...sb.sandboxes].sort((a, b) => (b.usage?.mem_mb ?? 0) - (a.usage?.mem_mb ?? 0)).slice(0, 10);
  return (
    <Section
      title={t.sandboxes}
      about={t.adminsOnly}
      side={t.sandboxesAbout(sb.running, sb.max_running)}
      wide={wide}
      testID="analytics-sandboxes"
    >
      {rows.length ? (
        <Bars
          rows={rows.map((r, i) => ({
            label: `${r.name || r.email || r.id}${r.env_name ? ` · ${r.env_name}` : ''}`,
            value: r.usage?.mem_mb ?? 0,
            text: `${r.state} · ${compact(r.usage?.mem_mb ?? 0)} MB · ${(r.usage?.cpu_pct ?? 0).toFixed(0)}%${r.last_active ? ` · ${whenOf(r.last_active, lang)}` : ''}`,
            color: r.state === 'running' ? SERIES[2] : r.state === 'error' ? colors.danger : SERIES[7 - (i % 1)],
          }))}
        />
      ) : (
        <Text style={s.none}>{t.nothing}</Text>
      )}
    </Section>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
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
  body: { paddingBottom: space.xl },
  bodyWide: { flexDirection: 'row', flexWrap: 'wrap' },
  section: {
    paddingHorizontal: gutter,
    paddingTop: space.lg,
    paddingBottom: space.lg,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sectionWide: { width: '50%', borderRightWidth: 1, borderRightColor: colors.line },
  secHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  secTitle: { fontFamily: fonts.sansSemi, fontSize: type.body, color: colors.ink },
  secSide: { flex: 1, textAlign: 'right', fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  about: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: -6 },
  figures: { gap: 2 },
  figure: { fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  figLabel: { color: colors.inkDim },
  small: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  sub: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.ink, marginTop: 4 },
  line: { fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  dim: { color: colors.inkDim },
  mono: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkDim },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateText: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  none: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim, padding: gutter },
});
