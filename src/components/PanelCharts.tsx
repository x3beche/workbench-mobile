/**
 * The panel sheet's graphs, as the web's column draws them (rooms/session-charts.ts): the window over the
 * session's turns, the run as a strip of what it was doing, and the changed lines piling up.
 *
 * Each one answers a question a person watching a run asks - will this session have to be left soon, what is it
 * doing now and where did it stall, is the work still growing - so they are drawn flat: a line, a fill, a row of
 * slices, in the app's own series colours (theme/tokens SERIES, the web's --series-1..8). Nothing is drawn when
 * there is nothing to draw: an empty axis says less than a word.
 *
 * The server works the numbers out (backend/wb_panel.py's series), so the phone lays out what it is given.
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import type { PanelSeries } from '../api/types';
import { SERIES } from './Charts';
import { colors, fonts, type } from '../theme/tokens';
import { breakAt, windowFor, xAt, type RangeId } from '../lib/sessionFlow';
import { clock, STALL_QUIET_MS } from '../lib/wboPanel';

/** What the strip colours a slice by - one entry per category the server names. */
export const CATS: { id: string; label: string; c: string }[] = [
  { id: 'read', label: 'reading', c: SERIES[0] },
  { id: 'edit', label: 'editing', c: SERIES[1] },
  { id: 'shell', label: 'shell', c: SERIES[2] },
  { id: 'web', label: 'web', c: SERIES[3] },
  { id: 'subagent', label: 'sub-agent', c: SERIES[4] },
  { id: 'mcp', label: 'MCP', c: SERIES[5] },
  { id: 'text', label: 'writing', c: SERIES[6] },
  { id: 'other', label: 'other', c: SERIES[7] },
];
export const catColor = (cat: string) => (CATS.find((x) => x.id === cat) ?? CATS[CATS.length - 1]).c;

/** The window over the turns: what each turn was given, the model's limit as a dashed line, and a mark where
 *  OpenCode compacted the session. The colour is the answer - normal, the warning's, the error's. */
export function ContextChart({
  points,
  limit,
  tone,
  testID,
}: {
  points: { turn: number; at: number | null; used: number; limit: number; drop?: boolean }[];
  limit: number;
  tone: string | null;
  testID?: string;
}) {
  const W = 300;
  const H = 56;
  const rows = points.filter((p) => p.used > 0);
  const peak = Math.max(1, ...rows.map((p) => p.used), limit || 0);
  const y = (v: number) => H - (v / peak) * (H - 2) - 1;
  const x = (i: number) => (rows.length <= 1 ? W : (i / (rows.length - 1)) * W);
  const line = rows.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.used).toFixed(1)}`).join(' ');
  const area = rows.length > 1 ? `${line} L${W},${H} L0,${H} Z` : '';
  const stroke = tone === 'bad' ? colors.danger : tone === 'warn' ? colors.warn : colors.accent;
  const fill = tone === 'bad' ? colors.danger : tone === 'warn' ? colors.warn : colors.accent;
  if (rows.length < 2) {
    return rows.length === 1 ? (
      <Text style={s.ctxOne}>
        {fmt(rows[0].used)}
        {rows[0].limit ? ` / ${fmt(rows[0].limit)}` : ''}
      </Text>
    ) : null;
  }
  return (
    <View style={s.ctx} testID={testID}>
      <View style={s.ctxBox}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <Path d={area} fill={fill} fillOpacity={0.16} />
          <Path d={line} stroke={stroke} strokeWidth={1.3} fill="none" />
          {limit ? (
            <Line x1={0} x2={W} y1={y(limit)} y2={y(limit)} stroke={colors.inkDim} strokeOpacity={0.5}
                  strokeWidth={1} strokeDasharray="3 3" />
          ) : null}
          {rows.map((p, i) =>
            p.drop ? (
              <Line key={`d${p.turn}`} x1={x(i)} x2={x(i)} y1={0} y2={H} stroke={colors.warn} strokeOpacity={0.8}
                    strokeWidth={1} strokeDasharray="2 3" />
            ) : null,
          )}
        </Svg>
        {limit ? <Text style={[s.axText, s.axTop]}>{fmt(limit)}</Text> : null}
        <Text style={[s.axText, s.axBot]}>0</Text>
      </View>
      <View style={s.ctxAx}>
        <Text style={s.ctxTurn}>turn {rows[0]?.turn ?? 1}</Text>
        <Text style={s.ctxTurn}>turn {rows[rows.length - 1]?.turn ?? rows.length}</Text>
      </View>
    </View>
  );
}

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'auto', label: 'auto' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1h' },
  { id: 'all', label: 'all' },
];

function gapText(ms: number): string {
  const h = ms / 3_600_000;
  if (h >= 1.5) return `${Math.round(h)}h`;
  const m = Math.round(ms / 60_000);
  return `${m}m`;
}

/** The run as a strip: tool slices above (≥2 units wide), writing as faint ground behind, pace hairline
 *  across the bottom, breaks for quiet stretches >10 min, and clocks at both ends. */
export function FlowStrip({
  series,
  now,
  working,
  range = 'auto',
  onRange,
  onJump,
  stall,
  testID,
}: {
  series: PanelSeries | undefined;
  now: number;
  working: boolean;
  range: RangeId;
  onRange: (id: RangeId) => void;
  onJump: (message: string) => void;
  stall: string;
  testID?: string;
}) {
  const W = 300;
  const H = 44;
  const STRIP_H = 34;
  const spans = useMemo(() => (series?.spans ?? []).filter((s) => s.cat !== 'text'), [series?.spans]);
  const bands = series?.bands ?? [];
  const win = useMemo(() => windowFor(range, spans, now, working), [range, spans, now, working]);
  const breaks = useMemo(() => breakAt(win, W), [win]);

  const sx = (at: number) => xAt(win, at, W);
  const sw = (from: number, to: number, min = 0.7) => Math.max(min, sx(to) - sx(from));

  const bandsIn = useMemo(
    () =>
      bands
        .filter((b) => b.end >= win.from && b.start <= win.to)
        .map((b) => ({
          ...b,
          start: Math.max(b.start, win.from),
          end: Math.min(Math.max(b.end, b.start + 400), win.to),
        })),
    [bands, win],
  );

  const slices = useMemo(
    () =>
      spans
        .filter((s) => s.end >= win.from && s.start <= win.to)
        .map((s) => ({
          ...s,
          start: Math.max(s.start, win.from),
          end: Math.min(Math.max(s.end, s.start + 400), win.to),
        }))
        .sort((a, b) => a.start - b.start),
    [spans, win],
  );

  const rateItems = series?.rate?.items ?? [];
  const rateStep = series?.rate?.step ?? 60_000;
  const rateLine = useMemo(() => {
    const rows = rateItems.filter((x) => x.at + rateStep >= win.from && x.at <= win.to);
    if (rows.length < 2) return '';
    const peak = Math.max(1, ...rows.map((r) => r.n));
    const top = STRIP_H + 2;
    const bottom = H - 2;
    return rows
      .map(
        (r, i) =>
          `${i ? 'L' : 'M'}${sx(r.at).toFixed(1)},${(bottom - (r.n / peak) * (bottom - top)).toFixed(1)}`,
      )
      .join(' ');
  }, [rateItems, rateStep, win]);

  const stuck = useMemo(() => {
    if (!working) return false;
    const last = rateItems.reduce((p, b) => Math.max(p, b.at + rateStep), 0);
    return !!last && now - last > STALL_QUIET_MS;
  }, [working, rateItems, rateStep, now]);

  const nowX = working ? sx(now) : null;

  // Legend counts calls only (writing is never in legend)
  const legend = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of slices) n.set(s.cat, (n.get(s.cat) ?? 0) + 1);
    return CATS.filter((c) => c.id !== 'text' && n.has(c.id))
      .map((c) => ({ ...c, n: n.get(c.id) ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 4);
  }, [slices]);

  const legendMore = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of slices) n.set(s.cat, (n.get(s.cat) ?? 0) + 1);
    const total = CATS.filter((c) => c.id !== 'text' && n.has(c.id)).length;
    return total > 4 ? total - 4 : 0;
  }, [slices]);

  if (!spans.length && !bands.length) return null;

  return (
    <View style={s.flowWrap} testID={testID}>
      <View style={s.stripTop}>
        <View style={s.legend}>
          {legend.map((k) => (
            <View key={k.id} style={s.key}>
              <View style={[s.keyDot, { backgroundColor: k.c }]} />
              <Text style={s.keyLabel}>{k.label}</Text>
              <Text style={s.keyCount}>{k.n}</Text>
            </View>
          ))}
          {legendMore > 0 ? (
            <Text style={s.keyMore}>+{legendMore}</Text>
          ) : null}
        </View>
        <View style={s.ranges}>
          {RANGES.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onRange(r.id)}
              style={[s.rangeBtn, range === r.id && s.rangeOn]}
              accessibilityRole="button"
              testID={`wbo-range-${r.id}`}
            >
              <Text style={[s.rangeText, range === r.id && s.rangeTextOn]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.stripBox}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {/* Flat writing ground behind everything */}
          {bandsIn.map((b, i) => (
            <Rect
              key={`b-${b.start}-${i}`}
              x={sx(b.start)}
              y={0}
              width={sw(b.start, b.end, 0.6)}
              height={STRIP_H}
              fill={colors.ink}
              fillOpacity={0.06}
            />
          ))}
          {/* Tool call slices (≥2 units wide) */}
          {slices.map((x, i) => (
            <Rect
              key={`${x.start}-${x.part}-${i}`}
              x={sx(x.start)}
              y={2}
              width={sw(x.start, x.end, 2)}
              height={STRIP_H - 4}
              fill={catColor(x.cat)}
              fillOpacity={0.92}
              onPress={x.part ? () => onJump(x.part) : undefined}
            />
          ))}
          {/* Error mark at top of slice */}
          {slices.map((x, i) =>
            x.status === 'error' ? (
              <Rect
                key={`e${i}`}
                x={sx(x.start)}
                y={0}
                width={sw(x.start, x.end, 2)}
                height={2}
                fill={colors.danger}
              />
            ) : null,
          )}
          {/* Folded quiet breaks */}
          {breaks.map((g, i) => (
            <Line
              key={`brk-${i}`}
              x1={g.x}
              x2={g.x}
              y1={0}
              y2={H}
              stroke={colors.line}
              strokeWidth={1}
              strokeDasharray="2 3"
              strokeOpacity={0.9}
            />
          ))}
          {/* Hairline pace */}
          {rateLine ? (
            <Path
              d={rateLine}
              stroke={stuck ? colors.warn : colors.inkDim}
              strokeOpacity={stuck ? 0.8 : 0.55}
              strokeWidth={1}
              fill="none"
            />
          ) : null}
          {/* Now line */}
          {nowX != null ? (
            <Line
              x1={nowX}
              x2={nowX}
              y1={0}
              y2={H}
              stroke={colors.inkBright}
              strokeOpacity={0.55}
              strokeWidth={1}
            />
          ) : null}
        </Svg>
        {breaks.map((g, i) => (
          <Text key={`btip-${i}`} style={[s.breakTip, { left: `${(g.x / W) * 100}%` }]}>
            {gapText(g.ms)}
          </Text>
        ))}
      </View>

      <View style={s.axis}>
        <Text style={s.axisTime}>{clock(win.from)}</Text>
        <Text style={s.axisTime}>{clock(win.to)}</Text>
      </View>

      {stall ? <Text style={s.stall}>{stall}</Text> : null}
    </View>
  );
}

/** The changed lines as they piled up: additions, deletions, both cumulative - a shape, not a chart with axes. */
export function DiffSpark({ points }: { points: { at: number; add: number; del: number }[] }) {
  const W = 54;
  const H = 16;
  if (points.length < 2) return null;
  const peak = Math.max(1, ...points.map((p) => Math.max(p.add, p.del)));
  const path = (pick: (p: { add: number; del: number }) => number) =>
    points
      .map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * W).toFixed(1)},${(H - (pick(p) / peak) * (H - 1)).toFixed(1)}`)
      .join(' ');
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} testID="wbo-diff-spark">
      <Path d={path((p) => p.add)} stroke={colors.ok} strokeWidth={1.2} fill="none" />
      <Path d={path((p) => p.del)} stroke={colors.danger} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

const s = StyleSheet.create({
  ctx: { marginTop: 6 },
  ctxBox: { position: 'relative' },
  ctxOne: { fontSize: type.small, color: colors.ink, marginTop: 6 },
  axText: { position: 'absolute', right: 0, fontFamily: fonts.mono, fontSize: 9, color: colors.inkDim },
  axTop: { top: 0 },
  axBot: { bottom: 0 },
  ctxAx: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  ctxTurn: { fontFamily: fonts.mono, fontSize: 9, color: colors.inkDim },
  flowWrap: { marginTop: 4 },
  stripTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
  key: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  keyDot: { width: 6, height: 6, borderRadius: 2 },
  keyLabel: { fontFamily: fonts.sans, fontSize: 9.5, color: colors.inkDim },
  keyCount: { fontFamily: fonts.mono, fontSize: 9.5, fontWeight: '600', color: colors.ink },
  keyMore: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.inkDim },
  ranges: { flexDirection: 'row', gap: 2 },
  rangeBtn: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  rangeOn: { backgroundColor: colors.surface2 },
  rangeText: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.inkDim },
  rangeTextOn: { color: colors.ink },
  stripBox: { position: 'relative' },
  breakTip: { position: 'absolute', top: '50%', transform: [{ translateX: -8 }, { translateY: -6 }],
             paddingHorizontal: 2, borderRadius: 2, backgroundColor: colors.surface,
             fontFamily: fonts.mono, fontSize: 8.5, color: colors.inkDim },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisTime: { fontFamily: fonts.mono, fontSize: 9, color: colors.inkDim },
  stall: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.warn, marginTop: 3 },
});
