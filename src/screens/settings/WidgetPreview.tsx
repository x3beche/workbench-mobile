/**
 * Settings > Home screen widget: the widget itself, at the size a launcher
 * gives it, drawn inside the app.
 *
 * It is not a second drawing of the card. Everything that decides what the
 * card says and how big its parts are comes from the widget's own file
 * (`widget/StatsWidget.tsx`): the two halves' words with `widgetTexts`, the
 * measures with `widest` and `metrics`, the chart with `barsPlan`, the plate's
 * grey, the dim ink and the two palettes. What changes is the ink: the widget
 * draws with `react-native-android-widget`'s own primitives, which only exist
 * inside a launcher, so here the same boxes are drawn with the app's views -
 * and in the app's bundled Plex files (the widget names the 700/500 files, the
 * app the 600/500/400: the same faces a step lighter).
 *
 * The numbers on it are made up: a picture of the card, not a reading of it.
 */
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { ChevronRight, Cpu, Wrench } from '../../components/icons';
import type { SettingsStrings } from '../../lib/settingsStrings';
import { colors, fonts, widgetGround } from '../../theme/tokens';
import type { WidgetSnapshot } from '../../widget/data';
import {
  SERIES,
  TOOL_COLORS,
  barsPlan,
  lift,
  metrics,
  softInk,
  widest,
  widgetTexts,
  type BarsPlan,
  type HalfText,
  type Metrics,
} from '../../widget/StatsWidget';

/** A launcher's 5x2 cell on a phone: 362 x 184 dp on a Samsung, 320 x 110 on a Pixel. */
const CELL = { w: 362, h: 184 };

/** The card's fourteen days, and its two figures - a picture of the widget, so no reading is asked for. */
const SAMPLE: WidgetSnapshot = {
  at: 0,
  models: {
    tokens: 1_204_300,
    calls: 9807,
    days: [
      [5200, 2100],
      [7400, 1800],
      [3100, 2600],
      [8800, 3400],
      [6400, 2900],
      [9100, 1200],
      [4700, 3800],
      [10200, 4100],
      [6900, 2200],
      [5400, 3600],
      [8200, 2800],
      [3900, 1700],
      [7600, 3300],
      [9300, 2400],
    ],
  },
  tools: {
    week: 412,
    kinds: 33,
    on: 88,
    total: 298,
    days: [
      [21, 12, 6],
      [18, 9, 8],
      [30, 15, 4],
      [24, 6, 11],
      [12, 18, 7],
      [27, 11, 9],
      [16, 14, 5],
      [33, 21, 12],
      [19, 8, 6],
      [25, 13, 10],
      [14, 19, 8],
      [29, 7, 4],
      [22, 16, 13],
      [11, 10, 9],
    ],
  },
};

/** A line's height in the app: Plex's own box, a little air, as the widget counts it in `BOX`. */
const line = (size: number) => Math.round(size * 1.32 * 10) / 10;

/** A figure and the word after it: "9,807 calls", "33 tools", "88/298". */
function Figure({
  value,
  word,
  size,
  tight,
  liftTo,
}: {
  value: string;
  word?: string;
  size: number;
  /** No air between them: a slash waits for its number, as in the web's `88/298`. */
  tight?: boolean;
  /** Standing in the big figure's row: raised onto its baseline, as the widget lifts it. */
  liftTo?: number;
}) {
  return (
    <View style={[s.figureRow, liftTo ? { marginBottom: lift('figure', size, 'figure', liftTo) } : null]}>
      <Text
        style={{ fontFamily: fonts.monoSemi, fontSize: size, lineHeight: line(size), color: colors.ink }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {word ? (
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: size,
            lineHeight: line(size),
            color: softInk(),
            marginLeft: tight ? 0 : Math.round(size * 0.6),
          }}
          numberOfLines={1}
        >
          {word}
        </Text>
      ) : null}
    </View>
  );
}

/** The fourteen days, as the widget's own `barsPlan` lays them out. */
function Chart({ plan, width, height }: { plan: BarsPlan; width: number; height: number }) {
  return (
    <View style={{ width, height }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: plan.floor, columnGap: plan.gap }}>
        {plan.columns.map((column, i) => (
          <View key={i} style={{ width: plan.bar, height: plan.floor, justifyContent: 'flex-end' }}>
            {column.segments.map((segment, j) => (
              <View
                key={j}
                style={{
                  width: plan.bar,
                  height: segment.height,
                  borderRadius: 1,
                  marginBottom: j < column.segments.length - 1 ? 1 : 0,
                  backgroundColor: segment.color,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      {/* The last pixel of the chart is the line the bars stand on. */}
      <View style={{ height: 1, width, backgroundColor: colors.line }} />
    </View>
  );
}

/** One half: its head, its figures and its chart, in the widget's own measures. */
function Half({
  icon,
  half,
  headRight,
  days,
  palette,
  width,
  m,
  divider,
}: {
  icon: 'models' | 'tools';
  half: HalfText;
  headRight?: React.ReactNode;
  days: number[][];
  palette: typeof SERIES;
  width: number;
  m: Metrics;
  /** The second card: the widget's `border-left` between the two. */
  divider?: boolean;
}) {
  const Icon = icon === 'models' ? Cpu : Wrench;
  const plan = barsPlan(days, width, m.chart, m.barGap, palette);
  const right = (
    <Figure value={half.value} word={half.word} size={m.smallFont} liftTo={m.figFont} />
  );
  return (
    <View
      style={{
        flex: 1,
        padding: m.cardPad,
        backgroundColor: colors.surface,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: colors.line,
      }}
    >
      <View style={s.head}>
        <Icon size={m.icon} color={softInk()} strokeWidth={2} />
        <Text
          style={[s.headTitle, { fontSize: m.headFont, lineHeight: line(m.headFont), marginLeft: m.headGap }]}
          numberOfLines={1}
        >
          {half.title}
        </Text>
        <View style={s.grow} />
        {headRight}
        <ChevronRight size={m.chev} color={colors.inkDim} strokeWidth={2} style={{ marginLeft: m.headGap }} />
      </View>
      {/* The figures as the web writes them: one row, or - in a cell with the
          height for it - the small figure in a row of its own under the big one. */}
      <View style={{ marginTop: m.gap }}>
        <View style={s.figureRow}>
          <Text
            style={{ fontFamily: fonts.monoSemi, fontSize: m.figFont, lineHeight: line(m.figFont), color: colors.ink }}
            numberOfLines={1}
          >
            {half.big}
          </Text>
          <Text
            style={{
              fontFamily: fonts.sansMedium,
              fontSize: m.smallFont,
              lineHeight: line(m.smallFont),
              color: softInk(),
              marginLeft: m.gap,
              marginBottom: lift('word', m.smallFont, 'figure', m.figFont),
            }}
            numberOfLines={1}
          >
            {half.unit}
          </Text>
          {m.stacked ? null : (
            <>
              <View style={s.grow} />
              {right}
            </>
          )}
        </View>
        {m.stacked ? <View style={[s.figureRow, { marginTop: m.gap }]}>{right}</View> : null}
      </View>
      <View style={s.grow} />
      <Chart plan={plan} width={width} height={m.chart} />
    </View>
  );
}

/**
 * The widget on the page: the launcher's cell at the width the page has (a
 * page is not a home screen, so the cell is as wide as the page and as tall as
 * a 5x2 cell is - the measures are the widget's own, from `metrics`).
 */
export function WidgetPreview({ t }: { t: SettingsStrings }) {
  const [room, setRoom] = useState(0);
  // Drawn at 362 dp wide where the page is that wide; narrower pages get the
  // same card in the room they have, the way a launcher hands it a smaller cell.
  const w = Math.min(room || CELL.w, CELL.w);
  const h = Math.round((w * CELL.h) / CELL.w);
  const texts = widgetTexts(SAMPLE, t);
  const m = metrics(w, h, widest([texts.models, texts.tools]));
  const onLayout = (e: LayoutChangeEvent) => setRoom(Math.round(e.nativeEvent.layout.width));
  return (
    <View
      testID="widget-preview"
      onLayout={onLayout}
      accessibilityRole="image"
      accessibilityLabel={t.widgetPreviewLabel}
    >
      {room ? (
        <View
          style={{
            width: w,
            height: h,
            padding: m.pad,
            flexDirection: 'row',
            backgroundColor: widgetGround,
            borderRadius: m.plateRadius,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: m.radius,
              backgroundColor: colors.surface,
              overflow: 'hidden',
            }}
          >
            <Half
              icon="models"
              half={texts.models}
              headRight={
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: m.headFont,
                    lineHeight: line(m.headFont),
                    color: softInk(),
                  }}
                  numberOfLines={1}
                >
                  {t.period.month}
                </Text>
              }
              days={SAMPLE.models.days}
              palette={SERIES}
              width={m.innerLeft}
              m={m}
            />
            <Half
              icon="tools"
              half={texts.tools}
              headRight={
                texts.tools.headRight ? (
                  <Figure value={String(SAMPLE.tools.on)} word={`/${SAMPLE.tools.total}`} size={m.headAside} tight />
                ) : null
              }
              days={SAMPLE.tools.days}
              palette={TOOL_COLORS}
              width={m.innerRight}
              m={m}
              divider
            />
          </View>
        </View>
      ) : (
        // The first pass, before the page has been measured: the plate alone.
        <View style={{ width: w, height: h, backgroundColor: widgetGround, borderRadius: m.plateRadius }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  headTitle: { flexShrink: 1, fontFamily: fonts.sansSemi, color: colors.ink },
  figureRow: { flexDirection: 'row', alignItems: 'flex-end' },
  grow: { flex: 1 },
});
