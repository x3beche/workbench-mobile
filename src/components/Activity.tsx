/**
 * The web top bar's Activity (frontend/src/app/topbar-activity.ts) on the
 * phone: what this account's models and machines are doing - everyone and
 * every agent of the account, the Orchestrator and its sub-agents too
 * (GET /api/me/activity?range=, backend/activity.py).
 *
 * The strip, a slim line under the conversation's top bar: the tokens a
 * second being written now (its dot green while they flow), a small
 * gradient chart of the tokens over the range chosen and their total, and
 * whichever of Claude prompts, jobs, CPU and memory are switched on - what
 * does not fit is left out from the end. A tap opens the sheet: the range
 * (the web's nine, or one's own: 1m to 30d), the figures, the tokens over
 * the range by source (a tap on the legend hides one), and what the strip
 * shows. The range and the strip's figures are kept per account on the
 * phone (lib/activity.ts).
 *
 * What goes on now comes through the account's S2 stream `activity`
 * (live/hub.ts) while it is up, else GET /api/me/activity/now every 5 s; the
 * range is asked again as often as its length suggests.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import type { WorkbenchClient } from '../api/client';
import type { ActivityData, ActivityNow } from '../api/types';
import {
  DEFAULT_PREFS,
  METRICS,
  RANGES,
  SOURCES,
  actSpan,
  cpu,
  everyMs,
  mem,
  nice,
  onActPrefs,
  readActPrefs,
  tok,
  totals,
  tps,
  words,
  writeActPrefs,
  type ActMetric,
  type ActPrefs,
  type ActSource,
  type Tr,
} from '../lib/activity';
import { inFront } from '../live/hub';
import { useLive } from '../live/LiveContext';
import { colors, fonts, gutter, radius, space, type } from '../theme/tokens';
import { SERIES } from './Charts';
import { Check } from './icons';
import { TallSheet } from './TallSheet';
import { Glyph } from './ui';

const NOW_MS = 5_000;
const colorOf = (id: ActSource) => SERIES[SOURCES.findIndex((s) => s.id === id)];

export interface ActivityFeed {
  prefs: ActPrefs;
  setPrefs: (p: ActPrefs) => void;
  data: ActivityData | null;
  now: ActivityNow | null;
  err: boolean;
  /** Another range on its way. */
  busy: boolean;
}

/** The account's activity over the range kept for it, and what goes on now. */
export function useActivity(client: WorkbenchClient | null, scope: string): ActivityFeed {
  const [prefs, setPrefsState] = useState<ActPrefs>(DEFAULT_PREFS);
  const [data, setData] = useState<ActivityData | null>(null);
  const [now, setNow] = useState<ActivityNow | null>(null);
  const [err, setErr] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    readActPrefs(scope).then((p) => {
      if (!live) return;
      setPrefsState(p);
      setReady(true);
    });
    const off = onActPrefs((sc, p) => sc === scope && setPrefsState(p));
    return () => {
      live = false;
      off();
    };
  }, [scope]);
  const setPrefs = useCallback((p: ActPrefs) => void writeActPrefs(scope, p), [scope]);

  // The range: at once when it changes, then as often as its length suggests.
  useEffect(() => {
    if (!client || !ready) return;
    let gone = false;
    const r = prefs.range;
    const load = () => {
      Promise.resolve()
        .then(() => client.activity(r))
        .then(
          (d) => {
            if (gone || d.range !== r) return;
            setData(d);
            setNow(d);
            setErr(false);
          },
          () => !gone && setErr(true),
        );
    };
    load();
    const t = setInterval(() => inFront() && load(), everyMs(r));
    return () => {
      gone = true;
      clearInterval(t);
    };
  }, [client, ready, prefs.range]);

  // Now: the stream while it is up, else a look every 5 s.
  const hub = useLive();
  const streaming = useRef(false);
  const take = useCallback((n: ActivityNow | null) => {
    if (n && typeof n.at === 'number') setNow(n);
  }, []);
  useEffect(() => {
    if (!hub) return;
    const f = hub.follow<ActivityNow>(take, { onLive: (l) => (streaming.current = l) });
    f.start();
    return () => hub.drop(f);
  }, [hub, take]);
  useEffect(() => {
    if (!client) return;
    let gone = false;
    const t = setInterval(() => {
      if (streaming.current || !inFront()) return;
      Promise.resolve()
        .then(() => client.activityNow())
        .then(
          (n) => !gone && take(n),
          () => undefined,
        );
    }, NOW_MS);
    return () => {
      gone = true;
      clearInterval(t);
    };
  }, [client, take]);

  // Another range on its way: the chart greys out until it comes.
  return { prefs, setPrefs, data, now, err, busy: !!data && data.range !== prefs.range };
}

/** The total over the range as a line and its gradient, `w` x `h`. */
function sparkPaths(d: ActivityData, w: number, h: number) {
  const tot = totals(d.series, d.n);
  const hi = Math.max(1, ...tot);
  const pts = tot.map((v, i) => `${((i * w) / Math.max(1, d.n - 1)).toFixed(1)},${(h - 1 - (v / hi) * (h - 3)).toFixed(1)}`);
  const line = `M${pts.join('L')}`;
  return { line, area: `${line}L${w},${h}L0,${h}Z` };
}

/** The strip under the top bar; a tap opens the sheet. Nothing until the server answers. */
export function ActivityStrip({
  client,
  scope,
  lang,
  testID = 'activity-strip',
}: {
  client: WorkbenchClient | null;
  scope: string;
  lang: 'en' | 'tr';
  testID?: string;
}) {
  const feed = useActivity(client, scope);
  const [open, setOpen] = useState(false);
  const t = useMemo(() => words(lang), [lang]);
  const { data, now, prefs } = feed;
  if (!data && !now) return null;
  const live = now?.live?.tps ?? 0;
  const m = now?.machine;
  const show = (x: ActMetric) => prefs.show.includes(x);
  const spark = data?.n ? sparkPaths(data, 56, 16) : null;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('Activity of this account - a tap opens it')}
        style={({ pressed }) => [s.strip, pressed && s.stripPressed]}
        testID={testID}
      >
        <View style={s.cells}>
          {show('tps') ? (
            <View style={s.cell}>
              <View style={[s.dot, live > 0 && s.dotOn]} testID={live > 0 ? 'activity-dot-on' : undefined} />
              <Text style={s.b}>{tps(live)}</Text>
              <Text style={s.small}>{t('out tok/s')}</Text>
            </View>
          ) : null}
          {show('spark') && spark ? (
            <View style={s.cell}>
              <Svg width={56} height={16}>
                <Defs>
                  <LinearGradient id="actSpark" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={SERIES[0]} stopOpacity={0.6} />
                    <Stop offset="1" stopColor={SERIES[0]} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Path d={spark.area} fill="url(#actSpark)" />
                <Path d={spark.line} stroke={SERIES[0]} strokeWidth={1.3} fill="none" strokeLinejoin="round" />
              </Svg>
            </View>
          ) : null}
          {show('tokens') && data ? (
            <View style={s.cell}>
              <Text style={s.b}>{tok(data.total.tokens)}</Text>
              <Text style={s.small}>{`tok · ${t(prefs.range)}`}</Text>
            </View>
          ) : null}
          {show('claude') && data?.claude ? (
            <View style={s.cell}>
              <Text style={s.b}>{data.claude.prompts.toLocaleString('en-US')}</Text>
              <Text style={s.small}>{t('prompts')}</Text>
            </View>
          ) : null}
          {show('jobs') && now ? (
            <View style={s.cell}>
              <Text style={s.small}>{t('Jobs')}</Text>
              <Text style={s.b}>{now.jobs?.total ?? 0}</Text>
            </View>
          ) : null}
          {show('cpu') && m ? (
            <View style={s.cell}>
              <Text style={s.small}>CPU</Text>
              <Text style={s.b}>{m.sampled ? cpu(m.cpu_pct) : '–'}</Text>
            </View>
          ) : null}
          {show('ram') && m ? (
            <View style={s.cell}>
              <Text style={s.small}>RAM</Text>
              <Text style={s.b}>{m.sampled || m.mem_mb ? mem(m.mem_mb) : '–'}</Text>
            </View>
          ) : null}
          {!prefs.show.length ? <Text style={s.small}>{t('Activity')}</Text> : null}
        </View>
      </Pressable>
      {open ? <ActivitySheet feed={feed} lang={lang} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** The sheet on its own (from Analytics' Activity card), with a feed of its own. */
export function ActivitySheetFor({
  client,
  scope,
  lang,
  onClose,
}: {
  client: WorkbenchClient | null;
  scope: string;
  lang: 'en' | 'tr';
  onClose: () => void;
}) {
  const feed = useActivity(client, scope);
  return <ActivitySheet feed={feed} lang={lang} onClose={onClose} />;
}

/** The web popover: the range, the figures, the chart by source, what the strip shows. */
export function ActivitySheet({ feed, lang, onClose }: { feed: ActivityFeed; lang: 'en' | 'tr'; onClose: () => void }) {
  const t = useMemo(() => words(lang), [lang]);
  const { data: d, now, prefs, setPrefs } = feed;
  const [hide, setHide] = useState<ReadonlySet<ActSource>>(new Set());
  const [draft, setDraft] = useState('');
  const custom = !RANGES.some((r) => r.id === prefs.range);
  const bad = !!draft.trim() && actSpan(draft) === null;
  const apply = () => {
    const v = draft.trim().toLowerCase();
    if (!v || actSpan(v) === null) return;
    setPrefs({ ...prefs, range: v });
    setDraft('');
  };
  const flip = (id: ActSource) => {
    const h = new Set(hide);
    if (h.has(id)) h.delete(id);
    else h.add(id);
    setHide(h);
  };
  const flipShown = (id: ActMetric) =>
    setPrefs({
      ...prefs,
      show: prefs.show.includes(id) ? prefs.show.filter((x) => x !== id) : METRICS.map((x) => x.id).filter((x) => x === id || prefs.show.includes(x)),
    });

  const x = d?.total;
  const split = x ? `${t('in')} ${tok(x.input)} · ${t('out')} ${tok(x.output)} · ${t('cache')} ${tok((x.cache_read ?? 0) + (x.cache_write ?? 0))}` : '';
  const by = now?.live?.by;
  const on = by ? SOURCES.filter((s) => (by[s.id] ?? 0) > 0) : [];
  const liveLine = by ? (on.length ? on.map((s) => `${t(s.label)} ${tps(by[s.id] ?? 0)}`).join(' · ') : t('idle')) : '';
  const j = now?.jobs;
  const jobsLine = j
    ? [t('{n} running', j.running), ...(j.queued ? [t('{n} waiting', j.queued)] : []), t('{n} agents', j.agents)].join(' · ')
    : '';
  const m = now?.machine;
  const boxes = !m?.sampled && !m?.parts?.length ? t('not measured yet') : (() => {
    const n = (m?.parts ?? []).filter((p) => p.kind !== 'jobs').length;
    return n === 1 ? t('1 container') : t('{n} containers', n);
  })();
  const partName = (k: string) => (k === 'orchestrator' ? t('Orchestrator') : k === 'sandbox' ? t('Sandbox') : t('Pool jobs'));
  const machineLine = (m?.parts ?? [])
    .map((p) => `${partName(p.kind)} ${p.cpu_pct != null ? `${cpu(p.cpu_pct)} · ` : ''}${mem(p.mem_mb)}`)
    .join('   ');
  const claude = d?.claude ?? null;

  const figs: { k: string; label: string; value: string; unit?: string; sub: string }[] = [
    { k: 'tokens', label: `${t('Tokens')} · ${t(prefs.range)}`, value: x ? tok(x.tokens) : '–', sub: split },
    { k: 'now', label: t('Now'), value: tps(now?.live?.tps ?? 0), unit: t('out tok/s'), sub: liveLine },
    { k: 'calls', label: t('Calls'), value: (x?.calls ?? 0).toLocaleString('en-US'), sub: t('in-app models') },
    ...(claude
      ? [{ k: 'claude', label: 'Claude', value: claude.prompts.toLocaleString('en-US'), unit: t('prompts'),
           sub: `${t('{n} calls', claude.calls)} · ${tok(claude.tokens)} tok` }]
      : []),
    { k: 'jobs', label: t('Jobs'), value: String(j?.total ?? 0), sub: jobsLine },
    { k: 'cpu', label: 'CPU', value: m?.sampled ? cpu(m.cpu_pct) : '–', sub: t('100% = one core') },
    { k: 'ram', label: t('Memory'), value: m && (m.sampled || m.mem_mb) ? mem(m.mem_mb) : '–', sub: boxes },
  ];

  return (
    <TallSheet
      title={t('Activity')}
      sub={t('this account: everyone in it, its agents and its Orchestrator')}
      closeLabel={t('Close')}
      onClose={onClose}
      testID="activity-sheet"
    >
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.ranges} accessibilityRole="radiogroup" accessibilityLabel={t('Range')}>
          {RANGES.map((r, i) => {
            const sel = prefs.range === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setPrefs({ ...prefs, range: r.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={t(r.long)}
                style={({ pressed }) => [s.seg, i === 0 && s.segFirst, sel && s.segOn, pressed && s.segPressed]}
                testID={`activity-range-${r.id}`}
              >
                <Text style={[s.segText, sel && s.segTextOn]}>{t(r.id)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.ownRow}>
          <TextInput
            value={draft || (custom ? prefs.range : '')}
            onChangeText={setDraft}
            onSubmitEditing={apply}
            onBlur={apply}
            placeholder={t('e.g. 15m')}
            placeholderTextColor={colors.inkDim}
            maxLength={6}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={t('Your own range')}
            accessibilityHint={t('Your own range: a number and m, h or d - 1m, 15m, 2h, 3d (up to 30d).')}
            style={[s.own, custom && !draft && s.ownOn, bad && s.ownBad]}
            testID="activity-own-range"
          />
          <Text style={s.ownHint} numberOfLines={2}>
            {t('Your own range: a number and m, h or d - 1m, 15m, 2h, 3d (up to 30d).')}
          </Text>
        </View>

        <View style={s.figs}>
          {figs.map((f) => (
            <View key={f.k} style={[s.fig, (f.k === 'tokens' || f.k === 'now') && s.figWide]} testID={`activity-fig-${f.k}`}>
              <Text style={s.figLabel} numberOfLines={1}>
                {f.label}
              </Text>
              <Text style={s.figValue} numberOfLines={1}>
                {f.value}
                {f.unit ? <Text style={s.figUnit}>{` ${f.unit}`}</Text> : null}
              </Text>
              <Text style={s.figSub} numberOfLines={2}>
                {f.sub}
              </Text>
            </View>
          ))}
        </View>

        {d ? (
          <>
            <ActivityChart data={d} hide={hide} busy={feed.busy} t={t} lang={lang} />
            <View style={s.legend}>
              {SOURCES.filter((src) => (src.id !== 'claude' || d.series.claude) && (src.id !== 'opencode' || d.total.by.opencode)).map(
                (src) => (
                  <Pressable
                    key={src.id}
                    onPress={() => flip(src.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !hide.has(src.id) }}
                    style={[s.key, hide.has(src.id) && s.keyOff]}
                    testID={`activity-legend-${src.id}`}
                  >
                    <View style={[s.keyDot, { backgroundColor: colorOf(src.id) }]} />
                    <Text style={s.keyText}>{t(src.label)}</Text>
                    <Text style={s.keyNum}>{tok(d.total.by[src.id] ?? 0)}</Text>
                  </Pressable>
                ),
              )}
            </View>
            {machineLine ? (
              <Text style={s.machine} numberOfLines={2}>
                {machineLine}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={s.machine}>{feed.err ? t('The activity did not load') : t('Loading…')}</Text>
        )}

        <View style={s.foot}>
          <Text style={s.footHead}>{t('Shown in the strip')}</Text>
          <View style={s.checks}>
            {METRICS.filter((mm) => mm.id !== 'claude' || claude).map((mm) => {
              const sel = prefs.show.includes(mm.id);
              return (
                <Pressable
                  key={mm.id}
                  onPress={() => flipShown(mm.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sel }}
                  style={s.check}
                  testID={`activity-show-${mm.id}`}
                >
                  <View style={[s.box, sel && s.boxOn]}>{sel ? <Glyph icon={Check} size={12} color={colors.inkOnAccent} /> : null}</View>
                  <Text style={s.checkText}>{mm.id === 'cpu' ? 'CPU' : t(mm.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </TallSheet>
  );
}

const T_PAD = 6;
const B_PAD = 16;

/** The tokens over the range, stacked by source, each with a gradient of its colour; a touch reads a column. */
function ActivityChart({
  data: d,
  hide,
  busy,
  t,
  lang,
  height = 160,
}: {
  data: ActivityData;
  hide: ReadonlySet<ActSource>;
  busy: boolean;
  t: Tr;
  lang: 'en' | 'tr';
  height?: number;
}) {
  const [w, setW] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  const shown = SOURCES.filter((src) => !hide.has(src.id) && (src.id !== 'claude' || !!d.series.claude));
  let hi = 0;
  for (let i = 0; i < d.n; i++) hi = Math.max(hi, shown.reduce((a, src) => a + (d.series[src.id]?.[i] ?? 0), 0));
  const max = nice(hi || 1);
  const L = Math.max(34, Math.round(tok(max).length * 6.2 + 10));
  const x = (i: number) => L + (w - L) * (d.n > 1 ? i / (d.n - 1) : 0.5);
  const y = (v: number) => height - B_PAD - ((height - B_PAD - T_PAD) * v) / max;
  const empty = !shown.some((src) => (d.series[src.id] ?? []).some((v) => v > 0));

  const layers = useMemo(() => {
    if (!w) return [];
    const base = new Array(d.n).fill(0);
    return shown
      .filter((src) => (d.series[src.id] ?? []).some((v) => v > 0))
      .map((src) => {
        const top: string[] = [];
        const low: string[] = [];
        const vs: number[] = [];
        for (let i = 0; i < d.n; i++) {
          const v = d.series[src.id]?.[i] ?? 0;
          vs.push(v);
          low.push(`${x(i).toFixed(1)},${y(base[i]).toFixed(1)}`);
          base[i] += v;
          top.push(`${x(i).toFixed(1)},${y(base[i]).toFixed(1)}`);
        }
        let line = '';
        for (let i = 0; i + 1 < d.n; i++) {
          if (!(vs[i] > 0 || vs[i + 1] > 0)) continue;
          line += (line && (vs[i - 1] > 0 || vs[i] > 0) ? 'L' : 'M') + top[i] + 'L' + top[i + 1];
        }
        return { id: src.id, c: colorOf(src.id), line, area: `M${top.join('L')}L${low.reverse().join('L')}Z` };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, w, hide, height]);

  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const label = (i: number, long: boolean) => {
    const when = new Date((d.t0 + (i + 1) * d.step) * 1000);
    if (d.step * d.n <= 86400 && !long) return when.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    return long
      ? when.toLocaleString(loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : when.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  };
  const read = (e: GestureResponderEvent) => {
    const px = e.nativeEvent.locationX;
    if (px < L || !d.n || !w) return setAt(null);
    setAt(Math.max(0, Math.min(d.n - 1, Math.round(((px - L) / (w - L)) * (d.n - 1)))));
  };
  const rows = at != null ? shown.map((src) => ({ id: src.id, name: t(src.label), v: d.series[src.id]?.[at] ?? 0 })) : [];

  return (
    <View
      style={[s.chart, { height }, busy && s.chartBusy]}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={read}
      onResponderMove={read}
      onResponderRelease={() => setAt(null)}
      onResponderTerminate={() => setAt(null)}
      accessibilityRole="image"
      accessibilityLabel={`${t('Tokens')} ${tok(d.total.tokens)}`}
      testID="activity-area"
    >
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            {layers.map((l) => (
              <LinearGradient key={l.id} id={`actG-${l.id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={l.c} stopOpacity={0.55} />
                <Stop offset="1" stopColor={l.c} stopOpacity={0.04} />
              </LinearGradient>
            ))}
          </Defs>
          {[0, 0.5, 1].map((k) => (
            <Line key={`g${k}`} x1={L} x2={w} y1={y(max * k)} y2={y(max * k)} stroke={colors.line} strokeWidth={1} />
          ))}
          {[0, 0.5, 1].map((k) => (
            <SvgText key={`y${k}`} x={L - 6} y={y(max * k) + 3} textAnchor="end" fontSize={10} fill={colors.inkDim} fontFamily={fonts.sans}>
              {tok(max * k)}
            </SvgText>
          ))}
          {d.n && w >= 80
            ? [0, Math.floor((d.n - 1) / 2), d.n - 1].map((i, k) => (
                <SvgText
                  key={`x${k}`}
                  x={x(i)}
                  y={height - 3}
                  textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
                  fontSize={10}
                  fill={colors.inkDim}
                  fontFamily={fonts.sans}
                >
                  {label(i, false)}
                </SvgText>
              ))
            : null}
          {layers.map((l) => (
            <Path key={`a${l.id}`} d={l.area} fill={`url(#actG-${l.id})`} />
          ))}
          {layers.map((l) =>
            l.line ? <Path key={`l${l.id}`} d={l.line} stroke={l.c} strokeWidth={1.4} fill="none" strokeLinejoin="round" /> : null,
          )}
          {at != null ? <Line x1={x(at)} x2={x(at)} y1={T_PAD} y2={height - B_PAD} stroke={colors.inkDim} strokeWidth={1} /> : null}
        </Svg>
      ) : null}
      {at != null ? (
        <View style={[s.tip, x(at) > w / 2 ? { right: w - x(at) + 8 } : { left: x(at) + 8 }]} pointerEvents="none">
          <Text style={s.tipHead}>{label(at, true)}</Text>
          {rows.map((r) => (
            <View key={r.id} style={s.tipRow}>
              <View style={[s.keyDot, { backgroundColor: colorOf(r.id) }]} />
              <Text style={s.tipName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={s.tipNum}>{tok(r.v)}</Text>
            </View>
          ))}
          <View style={[s.tipRow, s.tipTotal]}>
            <Text style={s.tipName}>{t('total')}</Text>
            <Text style={s.tipNum}>{tok(rows.reduce((a, r) => a + r.v, 0))}</Text>
          </View>
        </View>
      ) : null}
      {empty ? (
        <View style={s.empty} pointerEvents="none">
          <Text style={s.emptyText}>{t('No tokens in this range')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    height: 30,
    marginHorizontal: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stripPressed: { backgroundColor: colors.hover },
  // One line: a cell that does not fit wraps onto the next line, which is cut off.
  cells: {
    height: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 14,
    overflow: 'hidden',
  },
  cell: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line, marginRight: 1 },
  dotOn: { backgroundColor: colors.ok },
  b: { fontFamily: fonts.monoSemi, fontSize: 12, color: colors.ink },
  small: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },

  body: { paddingHorizontal: gutter, paddingBottom: space.xl, gap: space.md },
  // One segmented row, as the web's.
  ranges: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: space.xs,
  },
  seg: {
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
  },
  segFirst: { borderLeftWidth: 0 },
  segOn: { backgroundColor: colors.hover },
  ownRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.xs },
  ownHint: { flex: 1, fontFamily: fonts.sans, fontSize: 11, lineHeight: 14, color: colors.inkDim },
  segPressed: { backgroundColor: colors.pressed },
  segText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  segTextOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  own: {
    minHeight: 32,
    width: 84,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    fontFamily: fonts.mono,
    fontSize: type.tiny,
    color: colors.ink,
  },
  ownOn: { borderColor: colors.inkDim, color: colors.inkBright },
  ownBad: { borderColor: colors.danger, color: colors.danger },
  figs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: 4,
  },
  // The first two (with the longer lines under them) a half each, the rest a third, a short last row filling it.
  fig: { flexGrow: 1, flexBasis: '30%', paddingVertical: 6, paddingRight: 8, gap: 1 },
  figWide: { flexBasis: '45%' },
  figLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },
  figValue: { fontFamily: fonts.monoSemi, fontSize: 15, lineHeight: 20, color: colors.ink },
  figUnit: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },
  figSub: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 14, color: colors.inkDim },
  chart: { position: 'relative' },
  chartBusy: { opacity: 0.5 },
  empty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },
  tip: {
    position: 'absolute',
    top: 4,
    minWidth: 150,
    padding: 8,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  tipHead: { fontFamily: fonts.sansSemi, fontSize: 11, color: colors.ink, marginBottom: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipName: { flex: 1, fontFamily: fonts.sans, fontSize: 11, color: colors.ink },
  tipNum: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  tipTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingTop: 3, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
  keyOff: { opacity: 0.35 },
  keyDot: { width: 8, height: 8, borderRadius: 2 },
  keyText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.ink },
  keyNum: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkDim },
  machine: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingTop: space.sm, gap: 6 },
  footHead: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkDim },
  checks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 2 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 36 },
  box: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.inkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
});
