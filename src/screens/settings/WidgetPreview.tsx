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
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { ChevronRight, Cpu, RotateCcw, TriangleAlert, Wrench } from '../../components/icons';
import type { SettingsStrings } from '../../lib/settingsStrings';
import { colors, fonts, widgetGround } from '../../theme/tokens';
import type { WidgetSnapshot } from '../../widget/data';
import {
  REFRESH_TOUCH,
  SERIES,
  TOOL_COLORS,
  barsPlan,
  isStale,
  lift,
  metrics,
  softInk,
  whenText,
  widest,
  widgetTexts,
  type BarsPlan,
  type HalfText,
  type Metrics,
  type WidgetState,
} from '../../widget/StatsWidget';
import { readRefreshLog, type RefreshEntry } from '../../widget/log';
import { backgroundAllowed } from '../../widget/background';
import { power } from '../../../modules/workbench-power';
import { uiLang } from '../../update/strings';

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
  headState,
  refresh,
  days,
  palette,
  width,
  m,
  divider,
}: {
  icon: 'models' | 'tools';
  half: HalfText;
  headRight?: React.ReactNode;
  /** The corner beside the ↻: the reading's time, or what the last attempt did. */
  headState?: React.ReactNode;
  /** The ↻ in its finger-sized box (the widget's own button, drawn here as a picture). */
  refresh?: React.ReactNode;
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
        {headState}
        {refresh}
        {divider ? (
          <ChevronRight size={m.chev} color={colors.inkDim} strokeWidth={2} style={{ marginLeft: m.headGap }} />
        ) : null}
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

/** The four faces the card can wear: a reading, one being fetched, one that could not be, and an old one. */
const STATES = ['normal', 'refreshing', 'failed', 'stale'] as const;
type PreviewState = (typeof STATES)[number];

/**
 * The widget on the page: the launcher's cell at the width the page has (a
 * page is not a home screen, so the cell is as wide as the page and as tall as
 * a 5x2 cell is - the measures are the widget's own, from `metrics`).
 *
 * The four faces are the widget's own too, from the same props it is drawn with
 * on the home screen: a reading, one being refreshed, one whose last attempt did
 * not come back, and one that is hours old. A switch picks which is shown, so the
 * corner can be read without waiting for a phone to go into Doze.
 */
export function WidgetPreview({ t }: { t: SettingsStrings }) {
  const [room, setRoom] = useState(0);
  const [face, setFace] = useState<PreviewState>('normal');
  const [now] = useState(Date.now());
  // Drawn at 362 dp wide where the page is that wide; narrower pages get the
  // same card in the room they have, the way a launcher hands it a smaller cell.
  const w = Math.min(room || CELL.w, CELL.w);
  const h = Math.round((w * CELL.h) / CELL.w);
  const texts = widgetTexts(SAMPLE, t);
  const state: WidgetState = { refreshing: face === 'refreshing', failed: face === 'failed' };
  const at = face === 'stale' ? now - 3 * 3600_000 : now - 60_000;
  const corner = state.refreshing ? t.widgetRefreshingShort : state.failed ? t.widgetFailedShort
    : whenText(at, t, uiLang('auto'), now);
  const stale = face === 'stale' || isStale(at, now);
  const m = metrics(w, h, widest([texts.models, texts.tools], { refresh: true, state: corner }));
  const onLayout = (e: LayoutChangeEvent) => setRoom(Math.round(e.nativeEvent.layout.width));
  const cornerInk = state.failed || stale ? colors.warn : softInk();
  return (
    <View>
      <View style={s.states} accessibilityRole="tablist">
        {STATES.map((one) => (
          <Pressable
            key={one}
            onPress={() => setFace(one)}
            accessibilityRole="tab"
            accessibilityState={{ selected: face === one }}
            testID={`widget-face-${one}`}
            style={[s.state, face === one && s.stateOn]}
          >
            <Text style={[s.stateText, face === one && s.stateTextOn]}>
              {one === 'normal' ? t.widgetStateNormal : one === 'refreshing' ? t.widgetRefreshing
                : one === 'failed' ? t.widgetFailed : t.widgetStale}
            </Text>
          </Pressable>
        ))}
      </View>
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
                  texts.tools.headRight && !state.refreshing && !state.failed ? (
                    <Figure value={String(SAMPLE.tools.on)} word={`/${SAMPLE.tools.total}`} size={m.headAside} tight />
                  ) : null
                }
                headState={
                  <View style={s.corner}>
                    {state.failed ? <TriangleAlert size={m.headAside} color={colors.warn} strokeWidth={2} /> : null}
                    <Text
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: m.headAside,
                        lineHeight: line(m.headAside),
                        color: cornerInk,
                        marginLeft: m.headGap,
                      }}
                      numberOfLines={1}
                      testID="widget-preview-corner"
                    >
                      {corner}
                    </Text>
                  </View>
                }
                refresh={
                  // The button's own box (forty dp), the mark twelve: a picture of it here, the tap is Android's.
                  <View style={[s.refresh, { width: REFRESH_TOUCH, height: REFRESH_TOUCH }]}>
                    <RotateCcw size={m.chev} color={state.refreshing ? colors.inkDim : softInk()} strokeWidth={2} />
                  </View>
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
    </View>
  );
}

/**
 * Under the picture: the last twenty refresh attempts, and the power switch the
 * widget's own refreshes depend on. Both are read on the device - the log from
 * AsyncStorage (the widget's task writes it there too), the switch from Android
 * itself - and neither is guessed when they cannot be read.
 */
export function WidgetRefreshes({ t }: { t: SettingsStrings }) {
  const [log, setLog] = useState<RefreshEntry[] | null>(null);
  const [exempt, setExempt] = useState<boolean | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void readRefreshLog().then((rows) => live && setLog(rows));
    try {
      setExempt(power ? power.isIgnoringBatteryOptimizations() : null);
    } catch {
      setExempt(null);
    }
    void backgroundAllowed().then((yes) => live && setAllowed(yes));
    return () => {
      live = false;
    };
  }, []);

  const openBattery = async () => {
    if (Platform.OS !== 'android') return;
    const IntentLauncher = await import('expo-intent-launcher');
    try {
      // The list of apps with an exemption: no permission, no policy question - it is a settings page.
      await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    } catch {
      try {
        await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
          data: 'package:dev.workbench.mobile',
        });
      } catch {
        // Nothing to open on this device.
      }
    }
  };

  const when = (at: number) => whenText(at, t, uiLang('auto'));
  return (
    <View style={s.details}>
      <Text style={s.h}>{t.widgetLog}</Text>
      {log === null ? null : log.length === 0 ? (
        <Text style={s.dim}>{t.widgetLogEmpty}</Text>
      ) : (
        <View testID="widget-log">
          {log.map((e) => (
            <View key={`${e.at}:${e.trigger}`} style={s.logRow} testID="widget-log-row">
              <Text style={s.logWhen} numberOfLines={1}>{when(e.at)}</Text>
              <Text style={s.logWhat} numberOfLines={1}>
                {t.widgetTrigger[e.trigger] ?? e.trigger}
                {e.note ? ` · ${e.note}` : ''}
              </Text>
              <Text
                style={[s.logState, e.outcome === 'ok' ? null : e.outcome === 'error' ? s.bad : s.dim]}
                numberOfLines={1}
              >
                {e.outcome === 'ok' ? '✓' : e.outcome === 'error' ? '✕' : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[s.h, s.space]}>{t.widgetBattery}</Text>
      <Text
        style={[s.dim, exempt === false && s.warnText]}
        testID="widget-battery"
      >
        {exempt === null ? t.widgetBatteryUnknown : exempt ? t.widgetBatteryExempt : t.widgetBatteryRestricted}
      </Text>
      {allowed === false ? <Text style={[s.dim, s.warnText]}>{t.widgetBackground}</Text> : null}
      <Text style={[s.dim, s.space]}>{t.widgetBatteryNote}</Text>
      {Platform.OS === 'android' ? (
        <Pressable onPress={() => void openBattery()} accessibilityRole="button" style={s.batteryBtn} testID="widget-battery-open">
          <Text style={s.batteryBtnText}>{t.widgetBatteryOpen}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  corner: { flexDirection: 'row', alignItems: 'center' },
  refresh: { alignItems: 'center', justifyContent: 'center' },
  states: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  state: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  stateOn: { borderColor: colors.ink },
  stateText: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkDim },
  stateTextOn: { fontFamily: fonts.sansSemi, color: colors.ink },
  details: { marginTop: 16 },
  h: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink, marginBottom: 6 },
  space: { marginTop: 14 },
  dim: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.inkDim },
  warnText: { color: colors.warn },
  bad: { color: colors.danger },
  logRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 3 },
  logWhen: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkDim, width: 92 },
  logWhat: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  logState: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  batteryBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  batteryBtnText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink },
  headTitle: { flexShrink: 1, fontFamily: fonts.sansSemi, color: colors.ink },
  figureRow: { flexDirection: 'row', alignItems: 'flex-end' },
  grow: { flex: 1 },
});
