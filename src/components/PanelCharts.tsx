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
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import type { PanelSeries } from '../api/types';
import { SERIES } from './Charts';
import { colors, type } from '../theme/tokens';

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
  points: { turn: number; used: number; limit: number; drop?: boolean }[];
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
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Path d={area} fill={fill} fillOpacity={0.16} />
        <Path d={line} stroke={stroke} strokeWidth={1.3} fill="none" />
        {limit ? <Line x1={0} x2={W} y1={y(limit)} y2={y(limit)} stroke={colors.inkDim} strokeOpacity={0.5}
                       strokeWidth={1} strokeDasharray="3 3" /> : null}
        {rows.map((p, i) =>
          p.drop ? (
            <Line key={`d${p.turn}`} x1={x(i)} x2={x(i)} y1={0} y2={H} stroke={colors.warn} strokeOpacity={0.8}
                  strokeWidth={1} strokeDasharray="2 3" />
          ) : null,
        )}
      </Svg>
    </View>
  );
}

const RANGES = [
  { id: '15m', ms: 15 * 60_000, label: '15 min' },
  { id: '1h', ms: 60 * 60_000, label: '1 hour' },
  { id: 'all', ms: 0, label: 'all' },
] as const;

/** The run as a strip: every call a slice as long as it took, the writing between the calls the ground it
 *  stands on, a red notch where a call failed, and a line at "now". A tap on a slice takes the conversation to
 *  that call. Under it the output-token rate by the minute: a run that is thinking and one that is stuck look
 *  different there and nowhere else. */
export function FlowStrip({
  series,
  now,
  working,
  range,
  onRange,
  onJump,
  stall,
  testID,
}: {
  series: PanelSeries | undefined;
  now: number;
  working: boolean;
  range: '15m' | '1h' | 'all';
  onRange: (id: '15m' | '1h' | 'all') => void;
  onJump: (message: string) => void;
  /** "nothing new for 4 min" - or ''. */
  stall: string;
  testID?: string;
}) {
  const W = 300;
  const H = 30;
  const RH = 22;
  const spans = series?.spans ?? [];
  const step = series?.rate?.step ?? 60_000;
  const items = series?.rate?.items ?? [];
  const from = useMemo(() => {
    const r = RANGES.find((x) => x.id === range) ?? RANGES[0];
    if (r.ms) return now - r.ms;
    return Math.min(...spans.map((x) => x.start), now - 60_000);
  }, [range, now, spans]);
  const span = Math.max(1, now - from);
  const sx = (at: number) => ((at - from) / span) * W;
  const shown = spans
    .filter((x) => x.end >= from && x.start <= now)
    .map((x) => ({ ...x, start: Math.max(x.start, from), end: Math.min(Math.max(x.end, x.start + 400), now) }))
    .sort((a, b) => (a.cat === 'text' ? 0 : 1) - (b.cat === 'text' ? 0 : 1) || a.start - b.start);
  const rates = items.filter((b) => b.at + step >= from && b.at <= now);
  const peak = Math.max(1, ...rates.map((b) => b.n));
  const seen = new Set(shown.map((x) => x.cat));
  const legend = CATS.filter((c) => seen.has(c.id));
  if (!spans.length) return null;
  return (
    <View testID={testID}>
      <View style={s.stripTop}>
        <View style={s.legend}>
          {legend.map((c) => (
            <View key={c.id} style={s.key}>
              <View style={[s.keyDot, { backgroundColor: c.c }]} />
            </View>
          ))}
        </View>
        <View style={s.ranges}>
          {RANGES.map((r) => (
            <Text
              key={r.id}
              onPress={() => onRange(r.id)}
              style={[s.range, range === r.id ? s.rangeOn : null]}
              accessibilityRole="button"
              testID={`wbo-range-${r.id}`}
            >
              {r.label}
            </Text>
          ))}
        </View>
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {shown.map((x, i) => (
          <Rect
            key={`${x.start}-${x.part}-${i}`}
            x={sx(x.start)}
            y={2}
            width={Math.max(0.7, sx(x.end) - sx(x.start))}
            height={H - 4}
            fill={catColor(x.cat)}
            fillOpacity={x.cat === 'text' ? 0.28 : 0.9}
            onPress={x.part ? () => onJump(x.part) : undefined}
          />
        ))}
        {shown.map((x, i) =>
          x.status === 'error' ? (
            <Rect key={`e${i}`} x={sx(x.start)} y={0} width={Math.max(0.7, sx(x.end) - sx(x.start))} height={2}
                  fill={colors.danger} />
          ) : null,
        )}
        {working ? <Line x1={sx(now)} x2={sx(now)} y1={0} y2={H} stroke={colors.inkBright} strokeOpacity={0.55}
                         strokeWidth={1} /> : null}
      </Svg>
      {rates.length >= 2 ? (
        <Svg width="100%" height={RH} viewBox={`0 0 ${W} ${RH}`} preserveAspectRatio="none">
          {rates.map((b) => {
            const h = Math.max(1, (b.n / peak) * RH);
            return (
              <Rect key={b.at} x={sx(b.at) + 0.4} y={RH - h} width={Math.max(0.8, (step / span) * W - 0.8)}
                    height={h} fill={colors.inkDim} fillOpacity={0.45} />
            );
          })}
        </Svg>
      ) : null}
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
  ctxOne: { fontSize: type.small, color: colors.ink, marginTop: 6 },
  stripTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  key: { flexDirection: 'row', alignItems: 'center' },
  keyDot: { width: 6, height: 6, borderRadius: 2 },
  ranges: { flexDirection: 'row', gap: 2 },
  range: { fontSize: type.micro, color: colors.inkDim, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  rangeOn: { color: colors.ink, backgroundColor: colors.surface2 },
  stall: { fontSize: type.micro, color: colors.warn, marginTop: 3 },
});
