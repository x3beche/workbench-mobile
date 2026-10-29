/**
 * The charts Analytics draws, as the web app's cards draw theirs: fine
 * columns a day each, stacked by series in the theme's chart palette, the
 * highest value written at the top and the first and last day under them;
 * rows with a hairline bar under each for "by provider" and "by model"; and
 * a legend of small dots. Plain views - no chart library, no colour that is
 * not the theme's.
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, type } from '../theme/tokens';

/** The theme's chart palette, in order (the web's --series-1 to -8). */
export const SERIES = [
  colors.series1,
  colors.series2,
  colors.series3,
  colors.series4,
  colors.series5,
  colors.series6,
  colors.series7,
  colors.series8,
];

export interface Column {
  /** Under the first and last column. */
  label: string;
  parts: { value: number; color: string }[];
}

export function Columns({
  data,
  height = 96,
  format = String,
  bare = false,
  testID,
}: {
  data: Column[];
  height?: number;
  format?: (n: number) => string;
  /** As in a card (the web's mini stack): no figure above, no days under, finer gaps. */
  bare?: boolean;
  testID?: string;
}) {
  const totals = data.map((d) => d.parts.reduce((a, p) => a + Math.max(0, p.value), 0));
  const max = Math.max(0, ...totals);
  return (
    <View testID={testID}>
      {bare ? null : <Text style={s.max}>{max ? format(max) : ''}</Text>}
      <View
        style={[s.cols, bare && s.colsBare, { height }]}
        accessibilityRole="image"
        accessibilityLabel={max ? format(max) : undefined}
      >
        {data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={s.col}>
            {/* Stacked from the bottom: the first series lowest. */}
            {[...d.parts].reverse().map((p, j) =>
              p.value > 0 && max ? (
                <View key={j} style={{ height: Math.max(1, (p.value / max) * height), backgroundColor: p.color }} />
              ) : null,
            )}
            {!totals[i] ? <View style={s.zero} /> : null}
          </View>
        ))}
      </View>
      {bare ? null : (
        <View style={s.axis}>
          <Text style={s.tick}>{data[0]?.label ?? ''}</Text>
          <Text style={s.tick}>{data[data.length - 1]?.label ?? ''}</Text>
        </View>
      )}
    </View>
  );
}

export interface BarRow {
  label: string;
  value: number;
  /** What is written at the right: the value as it reads (a sum of money, calls and tokens). */
  text: string;
  color?: string;
}

/** Rows, each with a hairline bar under it as long as its share of the largest. */
export function Bars({ rows, testID }: { rows: BarRow[]; testID?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <View testID={testID} style={s.rows}>
      {rows.map((r) => (
        <View key={r.label} style={s.row}>
          <View style={s.rowTop}>
            <Text style={s.rowLabel} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={s.rowText} numberOfLines={1}>
              {r.text}
            </Text>
          </View>
          <View style={s.track}>
            <View style={[s.bar, { width: `${max ? Math.max(1, (r.value / max) * 100) : 0}%`, backgroundColor: r.color ?? colors.series1 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={s.legend}>
      {items.map((it) => (
        <View key={it.label} style={s.key}>
          <View style={[s.dot, { backgroundColor: it.color }]} />
          <Text style={s.keyText} numberOfLines={1}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  max: { fontFamily: fonts.sans, fontSize: type.micro, color: colors.inkDim, marginBottom: 2 },
  cols: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  colsBare: { gap: 2, borderBottomWidth: 0 },
  col: { flex: 1, justifyContent: 'flex-end', minWidth: 2, overflow: 'hidden', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  zero: { height: 1, backgroundColor: colors.line },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  tick: { fontFamily: fonts.sans, fontSize: type.micro, color: colors.inkDim },
  rows: { gap: 9 },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  rowLabel: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  rowText: { fontFamily: fonts.mono, fontSize: type.micro, color: colors.inkDim },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.hover, overflow: 'hidden' },
  bar: { height: 3, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  keyText: { fontFamily: fonts.sans, fontSize: type.micro, color: colors.inkDim },
});
