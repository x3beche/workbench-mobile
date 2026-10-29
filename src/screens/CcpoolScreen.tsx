/**
 * Settings > Claude pool, read-only, as the web's Settings > Claude pool
 * shows it to this person (GET /api/ccpool/overview, backend/ccpool.py):
 *
 *   Subscription usage  the plan's windows (5-hour, 7-day and any other) as
 *                       meters with their % and when they start again
 *   Plan this week      the 7-day window as a ring - each person's part in
 *                       their colour, Outside the pool grey, Unused the empty
 *                       track, the used % in the middle - and under it the
 *                       people for the week: requests, tokens, API value,
 *                       their part of the week and of the 5 hours (≈), last use
 *   My sessions         one's own Claude Code runs through the pool
 *
 * No keys given, no shares by hand: those stay on the web. The overview has
 * no event of its own on the bus, so it is read again every 30 s while the
 * page is open (and the app in front), and by a pull.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { PoolAccount, PoolOverview } from '../api/types';
import { SERIES } from '../components/Charts';
import { ArrowLeft, RotateCcw } from '../components/icons';
import { StateDot } from '../components/StateDot';
import { ScreenHeader } from '../components/ScreenHeader';
import { ErrorText, IconButton } from '../components/ui';
import {
  ago,
  apiValue,
  meters,
  mySummary,
  pct,
  planSlices,
  sessionName,
  sessionTokens,
  tokens,
  usd,
  weekRange,
  type Slice,
} from '../lib/ccpool';
import type { CcpoolStrings } from '../lib/ccpoolStrings';
import { colors, fonts, gutter, indicatorStyle, space, type } from '../theme/tokens';
import type { UiLang } from '../update/strings';

/** Read again this often while open: the overview has no event on the bus. */
export const POOL_EVERY = 30_000;

export function CcpoolScreen({
  client,
  t,
  lang,
  initial = null,
  onClose,
}: {
  client: WorkbenchClient | null;
  t: CcpoolStrings;
  lang: UiLang;
  /** What Settings already read, drawn at once. */
  initial?: PoolOverview | null;
  onClose: () => void;
}) {
  const [d, setD] = useState<PoolOverview | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  // The time the figures were read at: "3 min ago" and "starts again in" count from it.
  const [now, setNow] = useState(() => Date.now());
  const read = useCallback(
    async (loud: boolean) => {
      if (!client) return;
      if (loud) setBusy(true);
      try {
        setD(await client.ccpoolOverview());
        setNow(Date.now());
        setErr(null);
      } catch (e) {
        if (loud) setErr(e instanceof ApiError && e.message ? e.message : t.unreadable);
      } finally {
        if (loud) setBusy(false);
      }
    },
    [client, t],
  );
  useEffect(() => {
    const first = setTimeout(() => read(!initial), 0);
    const tick = setInterval(() => {
      if (AppState.currentState === 'active') read(false);
    }, POOL_EVERY);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, [read, initial]);

  const ms = d ? meters(d.plan, t, lang, now) : [];
  const wide = width >= 640;
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="ccpool-screen">
      <ScreenHeader
        title={t.title}
        left={<IconButton icon={ArrowLeft} label={t.title} onPress={onClose} testID="ccpool-back" />}
        right={
          <IconButton
            icon={RotateCcw}
            label={t.refresh}
            onPress={() => read(true)}
            color={colors.inkDim}
            testID="ccpool-refresh"
          />
        }
      />
      {!d ? (
        <View style={s.center}>{err ? <ErrorText>{err}</ErrorText> : <ActivityIndicator color={colors.inkDim} />}</View>
      ) : (
        <ScrollView
          indicatorStyle={indicatorStyle}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          contentContainerStyle={s.body}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => read(true)}
              tintColor={colors.inkDim}
              colors={[colors.ink]}
            />
          }
          testID="ccpool-list"
        >
          {err ? <ErrorText>{err}</ErrorText> : null}
          {ms.length ? (
            <View style={s.section} testID="ccpool-meters">
              <Text style={s.h}>{t.subscription}</Text>
              <Text style={s.dim}>{t.sharedPlan}</Text>
              <View style={[s.meters, wide && s.metersWide]}>
                {ms.map((m) => (
                  <View key={m.id} style={[s.meter, wide && s.meterWide]} testID={`ccpool-meter-${m.id}`}>
                    <View style={s.meterTop}>
                      <Text style={s.meterLabel} numberOfLines={1}>
                        {m.label}
                      </Text>
                      <Text style={[s.meterPct, m.tone && { color: colors[m.tone] }]}>{m.text}</Text>
                    </View>
                    <View style={s.track}>
                      <View
                        style={[s.fill, { width: `${m.pct}%` }, m.tone ? { backgroundColor: colors[m.tone] } : null]}
                      />
                    </View>
                    {m.reset ? <Text style={s.small}>{m.reset}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={s.section} testID="ccpool-plan">
            <View style={s.headRow}>
              <Text style={s.h}>{t.planWeek}</Text>
              <Text style={s.mono}>{d.plan.week_pct != null ? `${pct(d.plan.week_pct, lang)} ${t.used}` : '–'}</Text>
            </View>
            <Text style={s.dim}>{weekRange(d, t, lang)}</Text>
            <Plan d={d} t={t} lang={lang} />
            {d.accounts.length ? <People d={d} t={t} lang={lang} now={now} fit={width} /> : null}
          </View>

          {d.me.keys ? (
            <View style={s.section} testID="ccpool-mine">
              <Text style={s.h}>{t.mySessions}</Text>
              <Text style={s.dim}>{mySummary(d, t)}</Text>
              {d.my_sessions.length ? (
                <Table
                  fit={width}
                  cols={[
                    { label: t.name, w: 150 },
                    { label: t.status, w: 76 },
                    { label: t.computer, w: 100 },
                    { label: t.lastActivity, w: 96 },
                    { label: t.promptsCalls, w: 96, right: true },
                    { label: t.tokens, w: 72, right: true },
                    { label: t.apiValue, w: 80, right: true },
                  ]}
                  rows={d.my_sessions.map((x) => ({
                    key: x.session_id,
                    cells: [
                      <Text key="n" style={[s.cell, !x.title && !x.label && s.dimCell]} numberOfLines={1}>
                        {sessionName(x)}
                      </Text>,
                      <View key="st" style={s.stCell}>
                        <StateDot s={x.status === 'active' ? 'running' : x.status === 'idle' ? 'idle' : 'stopped'} />
                        <Text style={s.cell}>{t.state[x.status ?? 'ended']}</Text>
                      </View>,
                      <Text key="c" style={s.cell} numberOfLines={1}>
                        {x.key_name || '–'}
                      </Text>,
                      <Text key="l" style={s.cell} numberOfLines={1}>
                        {ago(x.last_ts, t, now)}
                      </Text>,
                      <Text key="p" style={[s.cell, s.num]}>
                        {`${x.prompts ?? '–'} / ${x.requests}`}
                      </Text>,
                      <Text key="t" style={[s.cell, s.num]}>
                        {tokens(sessionTokens(x))}
                      </Text>,
                      <Text key="v" style={[s.cell, s.num]}>
                        {usd(x.cost_usd)}
                      </Text>,
                    ],
                  }))}
                  testID="ccpool-sessions"
                />
              ) : (
                <Text style={s.dim}>{t.noSessions}</Text>
              )}
            </View>
          ) : !d.me.privileged ? (
            <Text style={[s.dim, s.section]}>{t.noKey}</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const sliceColor = (x: Slice) =>
  x.color === null
    ? colors.line
    : x.color === 'ink'
      ? colors.ink
      : x.color === 'dim'
        ? colors.inkDim
        : SERIES[x.color % SERIES.length];

/** The ring: arcs from the top, a hairline of ground between parts; the used % in the middle; the parts named beside it. */
function Plan({ d, t, lang }: { d: PoolOverview; t: CcpoolStrings; lang: UiLang }) {
  const sl = planSlices(d, t);
  if (!sl) return <Text style={s.dim}>{t.noFigure}</Text>;
  const R = 15.915; // circumference 100
  const gap = sl.length > 2 ? 0.6 : 0;
  // Where each part starts on the ring, from the top.
  const starts = sl.map((_, i) => sl.slice(0, i).reduce((n, x) => n + x.pct, 0));
  return (
    <View style={s.plan}>
      <View style={s.ring} accessibilityRole="image" accessibilityLabel={t.planWeek} testID="ccpool-ring">
        <Svg viewBox="0 0 42 42" width={150} height={150}>
          <Circle cx={21} cy={21} r={R} fill="none" stroke={colors.line} strokeWidth={5} />
          {sl.map((x, i) => {
            const len = Math.max(0, x.pct - (x.pct > gap * 2 ? gap : 0));
            const off = 25 - starts[i];
            return x.color === null ? null : (
              <Circle
                key={x.id}
                cx={21}
                cy={21}
                r={R}
                fill="none"
                stroke={sliceColor(x)}
                strokeWidth={5}
                strokeDasharray={`${len} ${100 - len}`}
                strokeDashoffset={off}
              />
            );
          })}
        </Svg>
        <Text style={s.ringMid}>{pct(d.plan.week_pct, lang)}</Text>
      </View>
      <View style={s.legend}>
        {sl.map((x) => (
          <View key={x.id} style={s.key} testID={`ccpool-slice-${x.id}`}>
            <View style={[s.swatch, { backgroundColor: sliceColor(x) }, x.color === null && s.swatchEmpty]} />
            <Text style={s.keyText} numberOfLines={1}>
              {x.label}
            </Text>
            <Text style={s.mono}>{(x.id === 'unused' ? '' : '≈') + pct(x.pct, lang)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The people for this week: requests, tokens, API value, their part of the week and the 5 hours, last use. */
function People({
  d,
  t,
  lang,
  now,
  fit,
}: {
  d: PoolOverview;
  t: CcpoolStrings;
  lang: UiLang;
  now: number;
  fit: number;
}) {
  const part = (v: number | null | undefined) => (v ? `≈${pct(v, lang)}` : '–');
  const row = (a: PoolAccount, i: number) => ({
    key: a.id,
    cells: [
      <View key="n" style={s.stCell}>
        <View style={[s.swatch, { backgroundColor: a.week.plan_pct ? SERIES[i % SERIES.length] : 'transparent' }]} />
        <Text style={s.cell} numberOfLines={1}>
          {a.name || a.email}
          {a.mine ? <Text style={s.dimCell}>{` · ${t.you}`}</Text> : null}
        </Text>
      </View>,
      <Text key="r" style={[s.cell, s.num]}>
        {a.week.requests ? a.week.requests.toLocaleString('en-US') : '–'}
      </Text>,
      <Text key="t" style={[s.cell, s.num]}>
        {tokens(a.week.total_tokens)}
      </Text>,
      <Text key="v" style={[s.cell, s.num]}>
        {apiValue(a.week)}
      </Text>,
      <Text key="p" style={[s.cell, s.num, s.strong]}>
        {a.week.plan_pct != null && (a.week.plan_pct > 0 || a.week.cost_usd) ? part(a.week.plan_pct) : '–'}
      </Text>,
      <Text key="p5" style={[s.cell, s.num]}>
        {part(a.week.plan5_pct)}
      </Text>,
      <Text key="l" style={[s.cell, !a.usage.last_ts && s.dimCell]} numberOfLines={1}>
        {ago(a.usage.last_ts, t, now)}
      </Text>,
    ],
  });
  const rows = d.accounts.map(row);
  const out = d.plan.outside;
  if (out?.seven_day || out?.five_hour)
    rows.push({
      key: 'outside',
      cells: [
        <Text key="n" style={[s.cell, s.dimCell]}>
          {t.outside}
        </Text>,
        <Text key="r" />,
        <Text key="t" />,
        <Text key="v" />,
        <Text key="p" style={[s.cell, s.num, s.dimCell]}>
          {part(out.seven_day)}
        </Text>,
        <Text key="p5" style={[s.cell, s.num, s.dimCell]}>
          {out.five_hour != null ? part(out.five_hour) : ''}
        </Text>,
        <Text key="l" />,
      ],
    });
  const sum = (f: 'requests' | 'total_tokens' | 'cost_usd') => d.accounts.reduce((n, a) => n + (a.week[f] || 0), 0);
  const foot =
    d.accounts.length > 1 || out?.seven_day
      ? [
          <Text key="n" style={[s.cell, s.strong]}>
            {t.allAccounts}
          </Text>,
          <Text key="r" style={[s.cell, s.num]}>
            {sum('requests').toLocaleString('en-US')}
          </Text>,
          <Text key="t" style={[s.cell, s.num]}>
            {tokens(sum('total_tokens'))}
          </Text>,
          <Text key="v" style={[s.cell, s.num]}>
            {usd(sum('cost_usd'))}
          </Text>,
          <Text key="p" style={[s.cell, s.num, s.strong]}>
            {pct(d.plan.week_pct, lang)}
          </Text>,
          <Text key="p5" style={[s.cell, s.num]}>
            {d.plan.five_hour ? pct(d.plan.five_hour.pct, lang) : ''}
          </Text>,
          <Text key="l" />,
        ]
      : undefined;
  return (
    <Table
      fit={fit}
      cols={[
        { label: t.account, w: 112 },
        { label: t.requests, w: 62, right: true },
        { label: t.tokens, w: 50, right: true },
        { label: t.apiValue, w: 70, right: true },
        { label: t.planWeek, w: 92, right: true },
        { label: t.plan5, w: 76, right: true },
        { label: t.lastUse, w: 92 },
      ]}
      rows={rows}
      foot={foot}
      testID="ccpool-people"
    />
  );
}

/**
 * A table as the web's st-table: a header of dim words, hairlines between
 * rows. Wider than the screen it scrolls sideways; narrower, the first
 * column takes what is left, so the table fills the width.
 */
function Table({
  cols,
  rows,
  foot,
  fit,
  testID,
}: {
  cols: { label: string; w: number; right?: boolean }[];
  rows: { key: string; cells: ReactNode[] }[];
  foot?: ReactNode[];
  fit: number;
  testID?: string;
}) {
  const need = cols.reduce((n, c) => n + c.w, 0) + (cols.length - 1) * 10;
  const grow = Math.max(0, fit - need);
  const width = (i: number) => cols[i].w + (i === 0 ? grow : 0);
  const line = (cells: ReactNode[], key: string, style?: object) => (
    <View key={key} style={[s.tr, style]}>
      {cells.map((c, i) => (
        <View key={i} style={[{ width: width(i) }, cols[i].right && s.right]}>
          {c}
        </View>
      ))}
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={need > fit} indicatorStyle={indicatorStyle} testID={testID}>
      <View>
        {line(
          cols.map((c) => (
            <Text key={c.label} style={s.th} numberOfLines={1}>
              {c.label}
            </Text>
          )),
          'head',
          s.thRow,
        )}
        {rows.map((r) => line(r.cells, r.key))}
        {foot ? line(foot, 'foot', s.foot) : null}
      </View>
    </ScrollView>
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
  title: { flex: 1, paddingHorizontal: 4, fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter },
  body: { paddingHorizontal: gutter, paddingBottom: space.xl },
  section: { gap: 6, paddingTop: space.lg },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  h: { fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.inkBright },
  dim: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.inkDim },
  small: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  mono: { fontFamily: fonts.mono, fontSize: type.tiny, color: colors.ink },
  meters: { gap: space.md, paddingTop: space.xs },
  metersWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  meter: { gap: 4 },
  meterWide: { flexBasis: 240, flexGrow: 1 },
  meterTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  meterLabel: { flex: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  meterPct: { fontFamily: fonts.mono, fontSize: type.small, color: colors.inkBright },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.hover },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  plan: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg, paddingVertical: space.sm },
  ring: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  ringMid: { position: 'absolute', fontFamily: fonts.mono, fontSize: type.body, color: colors.inkBright },
  legend: { flex: 1, minWidth: 160, gap: 6 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyText: { flex: 1, fontFamily: fonts.sans, fontSize: type.tiny, color: colors.ink },
  swatch: { width: 9, height: 9, borderRadius: 5 },
  swatchEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.inkDim },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    minHeight: 36,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  thRow: { minHeight: 30 },
  th: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.inkDim },
  foot: { borderBottomWidth: 0 },
  right: { alignItems: 'flex-end' },
  cell: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.ink },
  num: { fontFamily: fonts.mono, textAlign: 'right' },
  strong: { color: colors.inkBright },
  dimCell: { color: colors.inkDim },
  stCell: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
});
