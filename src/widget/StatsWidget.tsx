/**
 * The home screen widget: the web Chat tab's two cards - the models' month and
 * the tools' week, each with its last 14 days - on a light grey plate, split by
 * a hairline. It is the web's own drawing (cc-usage.ts CcUsageLine beside
 * cc-tools.ts CcToolsLine), piece for piece: the head with its icon, its name,
 * what it says at the right and a chevron; the figures row, the big figure in
 * the ink and the small ones dim; the chart along the bottom. The words are
 * the same ones the web card says, its "88/298" included.
 *
 * Everything is measured from the size the launcher hands us, against those
 * numbers at 320 dp (11px head, 15px figures, 10.5px asides, 7px padding, a
 * 34px chart): a 5x2 cell is 320x110 dp on one phone and 390x200 on another,
 * and a drawing of one size in the other's box is what left small words and a
 * band of nothing. So `s` scales type and padding with the width, and the
 * chart takes whatever height is left.
 *
 * It is drawn from primitives only (FlexWidget, TextWidget, SvgWidget): the
 * library renders a widget to an image, so nothing here may use a hook, a
 * context, an async call or any of the app's own views.
 */
'use no memo';
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import { compact } from '../lib/numbers';
import type { SettingsStrings } from '../lib/settingsStrings';
import { colors, widgetGround } from '../theme/tokens';
import type { WidgetSnapshot } from './data';

/**
 * The web card's own numbers (cc-usage.ts / cc-tools.ts / charts.ts): an 11px
 * head, a 15px figure with 10.5px asides, 7px padding on a wide screen and 9
 * on a narrow one, the head's 4px gap, a 5px card radius, a 34px chart. They
 * are absolute, not proportional: a wider card does not get bigger words on the
 * web, and it must not here either or the Tools card's "9,212 this week" and
 * "33 tools" stop fitting side by side.
 */
const HEAD_FONT = 11;
const FIG_FONT = 15;
const SMALL_FONT = 10.5;
/** Body is 13px/1.45 and the cards inherit it; the figures' `font:` shorthand resets theirs to normal, 1.28 in the web's own face. */
const TEXT_LINE = 1.45;
const FIG_LINE = 1.28;
/**
 * The widest figure row the two cards ask for - "9,212" + "this week" + "33
 * tools" with its gaps, 148.4px in the web's face. 152 leaves room for a face
 * that is a hair wider, and below it the type shrinks to fit rather than clip.
 */
const FIG_ROW = 152;

/** The theme's colours are strings; the widget's own type wants a `#` or an `rgba()`. */
const paint = (colour: string) => colour as ColorProp;

/** The providers' colours in the server's order, as the Analytics screen draws them. */
const SERIES: ColorProp[] = [
  colors.series1,
  colors.series2,
  colors.series3,
  colors.series4,
  colors.series5,
  colors.series6,
  colors.series7,
  colors.series8,
].map(paint);
/** The tools' three sources: the Chat, the person's Claude Code, their OpenCode. */
const TOOL_COLORS: ColorProp[] = [colors.series1, colors.series5, colors.series6].map(paint);

const MONO = 'monospace';

/** The web card's own icons (cc-usage.ts MODELS_ICON, cc-tools.ts WRENCH and CHEVRON), path for path. */
const MODELS_ICON = 'M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM10 10h4v4h-4z';
const WRENCH_ICON = 'M14.5 4.5a4 4 0 0 0-5 5L4 15l2 2 2 2 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z';
const CHEVRON_ICON = 'M10 7l5 5-5 5';

const glyph = (d: string, ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

/** Everything the drawing measures, from the box the launcher gave it. */
interface Metrics {
  s: number;
  pad: number;
  cardPad: number;
  gap: number;
  headFont: number;
  figFont: number;
  smallFont: number;
  /** The lines those fonts are drawn in: a widget is an image, so every box is ours to count. */
  headLine: number;
  figLine: number;
  smallLine: number;
  icon: number;
  chev: number;
  radius: number;
  plateRadius: number;
  chart: number;
  barGap: number;
  /** Each half's width inside its padding: what its 14 bars share. The right one is a hairline narrower, as the web's grid leaves it. */
  innerLeft: number;
  innerRight: number;
  headGap: number;
  figGap: number;
}

function metrics(w: number, h: number): Metrics {
  const pad = 6; // the web's `.ccl-wrap` margin round the card, now the plate's
  const cardPad = 9; // `.ccl` padding on a narrow screen - what a phone sees
  const gap = 4;
  // A half's room inside the plate, the card's two borders and its own padding.
  const half = (w - 2 * pad - 2) / 2;
  const innerLeft = half - 2 * cardPad;
  const innerRight = half - 1 - 2 * cardPad;
  // The web's sizes, given up only where the card is too narrow to hold the figure row.
  const s = Math.max(0.72, Math.min(1, (innerRight - 2) / FIG_ROW));
  const headFont = Math.round(HEAD_FONT * s * 10) / 10;
  const figFont = Math.round(FIG_FONT * s * 10) / 10;
  const smallFont = Math.round(SMALL_FONT * s * 10) / 10;
  // The web's own line boxes, unrounded: 11 x 1.45 = 15.95, 15 x 1.28 = 19.2.
  const headLine = Math.round(headFont * TEXT_LINE * 100) / 100;
  const figLine = Math.round(figFont * FIG_LINE * 100) / 100;
  // What the head, the figures and the two gaps between the lines take: the
  // chart is the rest, so a taller cell is a taller chart, not a band of nothing.
  const chart = Math.max(16, Math.round(h - 2 * pad - 2 - 2 * cardPad - headLine - figLine - 2 * gap));
  return {
    s,
    pad,
    cardPad,
    gap,
    headFont,
    figFont,
    smallFont,
    headLine,
    figLine,
    smallLine: Math.round(smallFont * TEXT_LINE * 100) / 100,
    icon: 13,
    chev: 12,
    radius: 5,
    plateRadius: 14,
    chart,
    barGap: 2,
    innerLeft,
    innerRight,
    headGap: 5,
    figGap: 4,
  };
}

/**
 * A figure and the word after it: the number in the ink and its word dim, the
 * web card's `em > b` - "9,807 calls", "33 tools", "88/298". Both are drawn in
 * the monospace face, as the web's `em` is, and in the figures' own line so
 * their baselines sit together.
 */
function Figure({
  value,
  word,
  m,
  line,
  tight = false,
}: {
  value: string;
  word?: string;
  m: Metrics;
  /** The line box it is drawn in: the head's, or the figures'. */
  line: number;
  /** No air between them: a slash waits for its number, as in the web's `88/298`. */
  tight?: boolean;
}) {
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        // The web puts a space between them, and in the monospace face that is 0.6em.
        flexGap: tight ? 0 : Math.round(m.smallFont * 0.6),
      }}
    >
      <TextWidget
        text={value}
        maxLines={1}
        style={{ fontSize: m.smallFont, lineHeight: line, fontFamily: MONO, fontWeight: '600', color: paint(colors.ink) }}
      />
      {word ? (
        <TextWidget
          text={word}
          maxLines={1}
          style={{ fontSize: m.smallFont, lineHeight: line, fontFamily: MONO, color: paint(colors.inkDim) }}
        />
      ) : null}
    </FlexWidget>
  );
}

/**
 * The 14 days as bars: each a column of stacked segments, bottom-up, in its
 * series' colours - the web's mini-stack (charts.ts), which stands them on a
 * hairline and gives each segment a 1px radius and 1px of air above it.
 */
function Bars({
  days,
  width,
  height,
  barGap,
  palette,
}: {
  days: number[][];
  width: number;
  height: number;
  barGap: number;
  palette: ColorProp[];
}) {
  const n = Math.max(1, days.length);
  // The web's columns are `flex: 1`, so they share the width to the last fraction
  // of a dp and the last bar ends flush with the card - a whole number each leaves
  // a strip of nothing at the right.
  const bar = Math.max(2, (width - barGap * (n - 1)) / n);
  const most = Math.max(1, ...days.map((d) => d.reduce((a, v) => a + v, 0)));
  // The last pixel of the chart is the line the bars stand on.
  const floor = Math.max(4, height - 1);
  return (
    <FlexWidget style={{ flexDirection: 'column', width, height }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', height: floor, width, flexGap: barGap }}>
        {days.map((day, i) => {
          // The heaviest series first, so the quietest sits on the baseline: the web chart's stack order, bottom-up.
          const segments = day
            .map((v, j) => ({ v, color: palette[j % palette.length] }))
            .filter((x) => x.v > 0)
            .reverse();
          // The air between the segments comes out of the column before the heights are worked out, so the stack ends on the line.
          const room = Math.max(1, floor - Math.max(0, segments.length - 1));
          return (
            <FlexWidget key={i} style={{ width: bar, height: floor, flexDirection: 'column', justifyContent: 'flex-end' }}>
              {segments.map((x, j) => (
                <FlexWidget
                  key={j}
                  style={{
                    width: bar,
                    height: Math.max(1, Math.round((x.v / most) * room)),
                    borderRadius: 1,
                    marginBottom: j < segments.length - 1 ? 1 : 0,
                    backgroundColor: x.color,
                  }}
                />
              ))}
            </FlexWidget>
          );
        })}
      </FlexWidget>
      <FlexWidget style={{ height: 1, width, backgroundColor: paint(colors.line) }} />
    </FlexWidget>
  );
}


/**
 * The web card's own figure formatting (cc-usage.ts `num`), so the two write the
 * same text: 2.19B, 1.2M, 12.35k, 9,807.
 */
function figure(n: number): string {
  const a = Math.abs(n);
  if (a >= 999.95e6) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(2)}k`;
  if (a >= 100) return Math.round(n).toLocaleString('en-US');
  return String(Math.round(n * 100) / 100);
}

/** One half: its icon and name, what the head says at the right, the figures, the chart. */
function Half({
  icon,
  title,
  headRight,
  big,
  unit,
  figRight,
  days,
  palette,
  m,
  label,
  width,
  divider = false,
}: {
  icon: string;
  title: string;
  headRight: React.ReactNode;
  big: string;
  unit: string;
  figRight: React.ReactNode;
  days: number[][];
  palette: ColorProp[];
  m: Metrics;
  label: string;
  /** What this half's bars share. */
  width: number;
  /** The second card: the web's `border-left` between the two. */
  divider?: boolean;
}) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        height: 'match_parent',
        padding: m.cardPad,
        flexDirection: 'column',
        flexGap: m.gap,
        backgroundColor: paint(colors.surface),
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: divider ? paint(colors.line) : undefined,
      }}
      accessibilityLabel={label}
    >
      <FlexWidget
        style={{ flexDirection: 'row', alignItems: 'center', flexGap: m.headGap, width: 'match_parent' }}
      >
        <SvgWidget svg={icon} style={{ width: m.icon, height: m.icon }} />
        <TextWidget
          text={title}
          maxLines={1}
          style={{ fontSize: m.headFont, lineHeight: m.headLine, fontWeight: '600', color: paint(colors.ink) }}
        />
        <FlexWidget style={{ flex: 1 }} />
        {headRight}
        <SvgWidget
          svg={glyph(CHEVRON_ICON, colors.inkDim)}
          style={{ width: m.chev, height: m.chev }}
        />
      </FlexWidget>
      <FlexWidget
        style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: m.figGap, width: 'match_parent' }}
      >
        <TextWidget
          text={big}
          maxLines={1}
          style={{ fontSize: m.figFont, lineHeight: m.figLine, fontWeight: '600', fontFamily: MONO, color: paint(colors.ink) }}
        />
        <TextWidget
          text={unit}
          maxLines={1}
          style={{ fontSize: m.smallFont, lineHeight: m.figLine, color: paint(colors.inkDim) }}
        />
        <FlexWidget style={{ flex: 1 }} />
        {figRight}
      </FlexWidget>
      {/* The rest of the card is the chart's, and the chart stands on the bottom
          edge - the web's `margin-top: auto` - with no gap counted for it. */}
      <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'flex-end' }}>
        <Bars days={days} width={width} height={m.chart} barGap={m.barGap} palette={palette} />
      </FlexWidget>
    </FlexWidget>
  );
}

const count = (n: number) => n.toLocaleString('en-US');

export function StatsWidget({
  snap,
  w,
  h,
  t,
}: {
  snap: WidgetSnapshot | null;
  /** The widget's own size, in dp: every measure here is worked out from it. */
  w: number;
  h: number;
  t: SettingsStrings;
}) {
  const m = metrics(w, h);
  // One sentence for a screen reader: the widget itself is a picture to it.
  const label = snap
    ? `${t.models}, ${t.period.month}: ${compact(snap.models.tokens)} tok, ${count(snap.models.calls)} ${t.calls}. ${t.tools}, ${t.period.week}: ${count(snap.tools.week)}, ${t.toolCount(snap.tools.kinds)}.`
    : `${t.models} · ${t.tools}. ${t.nothing}`;
  const plate = {
    width: 'match_parent' as const,
    height: 'match_parent' as const,
    backgroundColor: paint(widgetGround),
    borderRadius: m.plateRadius,
    padding: m.pad,
    flexDirection: 'row' as const,
  };
  const card = {
    flex: 1,
    flexDirection: 'row' as const,
    borderWidth: 1,
    borderColor: paint(colors.line),
    borderRadius: m.radius,
    backgroundColor: paint(colors.surface),
    overflow: 'hidden' as const,
  };
  if (!snap) {
    return (
      <FlexWidget
        style={{ ...plate, flexDirection: 'column', justifyContent: 'center' }}
        clickAction="OPEN_APP"
        accessibilityLabel={label}
      >
        <FlexWidget style={{ ...card, flexDirection: 'column', justifyContent: 'center', flexGap: m.gap, padding: m.cardPad }}>
          <TextWidget
            text={`${t.models} · ${t.tools}`}
            maxLines={1}
            style={{ fontSize: m.headFont, lineHeight: m.headLine, fontWeight: '600', color: paint(colors.ink) }}
          />
          <TextWidget
            text={t.nothing}
            maxLines={1}
            style={{ fontSize: m.smallFont, lineHeight: m.smallLine, color: paint(colors.inkDim) }}
          />
        </FlexWidget>
      </FlexWidget>
    );
  }
  return (
    <FlexWidget style={plate} clickAction="OPEN_APP" accessibilityLabel={label}>
      <FlexWidget style={card}>
        <Half
          icon={glyph(MODELS_ICON, colors.inkDim)}
          title={t.models}
          headRight={
            <TextWidget
              text={t.period.month}
              maxLines={1}
              style={{ fontSize: m.headFont, lineHeight: m.headLine, color: paint(colors.inkDim) }}
            />
          }
          big={figure(snap.models.tokens)}
          unit="tok"
          figRight={<Figure value={count(snap.models.calls)} word={t.calls} m={m} line={m.figLine} />}
          days={snap.models.days}
          palette={SERIES}
          width={m.innerLeft}
          m={m}
          label={`${t.models}: ${compact(snap.models.tokens)} tok, ${count(snap.models.calls)} ${t.calls}`}
        />

        <Half
          icon={glyph(WRENCH_ICON, colors.inkDim)}
          title={t.tools}
          headRight={
            // The web head's "88/298" - the tools that are on, out of all of them.
            snap.tools.total ? (
              <Figure value={String(snap.tools.on)} word={`/${count(snap.tools.total)}`} m={m} line={m.smallLine} tight />
            ) : null
          }
          big={snap.tools.week >= 1e4 ? figure(snap.tools.week) : String(snap.tools.week)}
          unit={t.period.week}
          figRight={<Figure value={count(snap.tools.kinds)} word={t.toolWord(snap.tools.kinds)} m={m} line={m.figLine} />}
          days={snap.tools.days}
          palette={TOOL_COLORS}
          width={m.innerRight}
          divider
          m={m}
          label={`${t.tools}: ${count(snap.tools.week)} ${t.period.week}, ${t.toolCount(snap.tools.kinds)}`}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
