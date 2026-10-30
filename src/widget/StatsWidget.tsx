/**
 * The home screen widget: the web Chat tab's two cards - the models' month and
 * the tools' week, each with its last 14 days - on a mid grey plate, split by
 * a hairline. It is the web's own drawing (cc-usage.ts CcUsageLine beside
 * cc-tools.ts CcToolsLine), piece for piece: the head with its icon, its name,
 * what it says at the right and a chevron; the figures row, the big figure in
 * the ink and the small ones dim; the chart along the bottom. The words are
 * the same ones the web card says, its "88/298" included.
 *
 * Everything is measured from the size the launcher hands us: a 5x2 cell is
 * 320x110 dp on one phone, about 362x184 on a Samsung and 390x200 on another,
 * and a drawing of one size in the other's box is what left small words and a
 * band of nothing. So one factor scales type and padding to the room the
 * widest line leaves, and the chart takes whatever height is left.
 *
 * The faces are the web's own, IBM Plex Sans and IBM Plex Mono, bundled with
 * the app (app.json, the widget plugin's `fonts`) and named by file: the
 * library looks a `fontFamily` up among the app's font assets and falls back to
 * the launcher's default sans for any other name - "monospace" included, so
 * before 1.9.8 the figures were drawn in Samsung's own sans at a weight it
 * made up, which is what read thin.
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
import type { UiLang } from '../update/strings';
import { colors, widgetGround } from '../theme/tokens';
import type { WidgetSnapshot } from './data';

/**
 * The card as the web draws it on a phone, read off the site in a browser
 * (cc-usage.ts / cc-tools.ts / charts.ts): an 11px head, a 15px figure with
 * 10.5px asides, 9px padding on a narrow screen, the head's 5px gap, a 13px
 * icon, a 12px chevron, and 14 bars two px apart on the 1px line - with the
 * head and the asides a step larger against the figure (12 and 11.5 where the
 * web has 11 and 10.5): on a phone's home screen, at arm's length and over a
 * wallpaper, the web's small words read as thin (the user, 2026-10-29).
 * `metrics` multiplies all of them by one factor. The corners are not among
 * them: they are the launcher's (`CORNER`).
 */
const WEB = {
  head: 12,
  fig: 15,
  aside: 11.5,
  pad: 9,
  gap: 4,
  headGap: 5,
  icon: 14,
  chev: 12,
  barGap: 2,
};
/**
 * The faces, by their font files' names (assets/fonts in the APK): the figures
 * in Plex Mono Bold - the web's are SemiBold on a lit screen; on a home screen
 * a step heavier holds up - the heads' names in Plex Sans Bold, and every small
 * word in the Medium of its face rather than the Regular, so nothing on the
 * card is drawn at 400. `fontWeight` is the file's own, passed with it so Android
 * matches the file rather than thickening it.
 */
const FACE = {
  title: { fontFamily: 'IBMPlexSans_700Bold', fontWeight: '700' },
  word: { fontFamily: 'IBMPlexSans_500Medium', fontWeight: '500' },
  figure: { fontFamily: 'IBMPlexMono_700Bold', fontWeight: '700' },
  aside: { fontFamily: 'IBMPlexMono_500Medium', fontWeight: '500' },
} as const;
/**
 * The launcher's corner. From Android 12 a launcher rounds the whole widget
 * off - the library's root is `@android:id/background`, and the widget is one
 * picture inside it - at `system_app_widget_background_radius`: 16dp on a
 * Pixel, more on a Samsung (One UI's widgets are rounder, a little under 28),
 * and the platform caps it at 28. The picture is drawn in the app, where that
 * value cannot be read, so the plate is drawn at the cap: on any launcher the
 * cut then falls outside the plate's own curve, never into it.
 */
const CORNER = 28;
/**
 * The plate's padding: at least the depth of the curve on the diagonal,
 * R(1 - 1/sqrt 2) = 8.2, and a dp more, so the card's corner stays clear of the
 * cut and the card inside rounds at the same centre, R - pad.
 */
const PLATE_PAD = Math.ceil(CORNER * (1 - Math.SQRT1_2)) + 1;
const CARD_RADIUS = CORNER - PLATE_PAD;
/**
 * How Android boxes a line of each face, in ems: a one-line TextView is as tall
 * as its font's bounding box (the head table's yMax over yMin - includeFontPadding)
 * whatever line height it is given, and its baseline sits `under` above the
 * box's foot. Plex Mono reaches lower than Plex Sans, so a figure and the sans
 * word beside it, both stood on the row's foot, would not share a baseline:
 * `lift` raises the smaller one to it.
 */
const BOX: Record<keyof typeof FACE, { tall: number; under: number }> = {
  title: { tall: 1.425, under: 0.275 },
  word: { tall: 1.39, under: 0.258 },
  figure: { tall: 1.5, under: 0.35 },
  aside: { tall: 1.482, under: 0.35 },
};
const tall = (face: keyof typeof FACE, size: number) => Math.ceil(size * BOX[face].tall * 100) / 100;
/** What lifts a line of `face` at `size` onto the baseline of a taller one beside it, both on the row's foot. */
export const lift = (face: keyof typeof FACE, size: number, by: keyof typeof FACE, bySize: number) =>
  Math.max(0, Math.round((bySize * BOX[by].under - size * BOX[face].under) * 10) / 10);
/**
 * How wide each character is in IBM Plex Sans, in ems, at 500 and at 700 - read
 * off the bundled font files' own advances (hmtx), glyph by glyph, for every
 * letter the card's words and figures can have in English and Turkish. The
 * monospace face needs no table: each of Plex Mono's glyphs, at any weight, is 0.6em.
 */
const GLYPHS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,./%·çğıöşüÇĞİÖŞÜ–-';
const SANS: Record<500 | 700, number[]> = {
  500: [
    549, 592, 509, 592, 555, 340, 538, 580, 265, 265, 548, 285, 882, 580, 562, 592, 592, 383, 494, 365, 580, 512, 799,
    530, 514, 487, 660, 659, 634, 682, 593, 570, 705, 714, 414, 531, 660, 513, 815, 714, 711, 627, 711, 655, 599, 577,
    685, 627, 926, 639, 617, 592, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 236, 288, 288, 416, 947, 340, 509,
    544, 265, 562, 494, 580, 634, 705, 414, 711, 599, 685, 588, 401,
  ],
  700: [
    569, 608, 517, 608, 562, 361, 552, 596, 286, 286, 577, 303, 894, 596, 564, 608, 608, 404, 504, 383, 596, 538, 841,
    560, 534, 518, 685, 667, 651, 697, 607, 585, 719, 724, 432, 559, 696, 530, 819, 724, 714, 656, 714, 674, 624, 584,
    694, 650, 973, 673, 649, 607, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 236, 310, 310, 460, 974, 358, 517,
    562, 286, 564, 504, 596, 651, 719, 432, 714, 624, 694, 588, 403,
  ],
};

/** A line's width in ems: the sans face by its table (an unknown letter counted wide), the monospace one at 0.6 each. */
function ems(text: string, face: 'sans' | 'mono', weight: 500 | 700 = 500): number {
  if (face === 'mono') return [...text].length * 0.6;
  let w = 0;
  for (const ch of text) {
    const at = GLYPHS.indexOf(ch);
    w += at < 0 ? 0.7 : SANS[weight][at] / 1000;
  }
  return w;
}

/** What one half writes: its head and its figures row, the text the drawing is sized to. */
export interface HalfText {
  title: string;
  /** The head's right: a word in the sans face, or the monospace "88/298". */
  headRight?: { text: string; mono: boolean };
  big: string;
  unit: string;
  value: string;
  word: string;
}

/** The room a half's lines ask for at the card's scale of 1, in the sizes of `WEB`. */
interface Room {
  /** The head: icon, name, what it says at the right, chevron, and the gaps between them and the spring. */
  head: number;
  /** The figures as the web writes them, in one row: the big figure, its word, the spring and the small figure with its word. */
  row: number;
  /** The same figures in two rows: the big figure and its word over the small figure and its own. */
  big: number;
  small: number;
}

/**
 * What the widget is doing when it is drawn: the refresh button was just pressed,
 * or the last attempt to reach the server did not come back. Drawn in the corner
 * beside the ↻, never over the figures.
 */
export interface WidgetState {
  refreshing?: boolean;
  failed?: boolean;
}

/** The ↻'s touch box: a finger needs 40 dp even when the mark is twelve. */
export const REFRESH_TOUCH = 40;
/** How old a reading may be before the card says so, in ms (2 h). */
export const STALE_MS = 2 * 3600_000;

const REFRESH_ICON = 'M20 12a8 8 0 1 1-2.3-5.6 M20 4v6h-6';
const WARN_ICON = 'M12 3l9 17H3z M12 9v5 M12 17v.3';

/** "14:32", "yesterday 22:10", "12 Aug 22:10" - the reading's own time, short. */
export function whenText(at: number, t: SettingsStrings, lang: UiLang = 'en', now = Date.now()): string {
  if (!at) return t.widgetNever;
  const d = new Date(at);
  const n = new Date(now);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.toDateString() === n.toDateString();
  const yesterday = new Date(now - 86400_000);
  const date = d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' });
  return t.widgetWhen(sameDay, d.toDateString() === yesterday.toDateString(), time, date);
}

/** Whether the reading is older than the card may quietly show. */
export function isStale(at: number, now = Date.now(), after = STALE_MS): boolean {
  return !at || now - at > after;
}

/** The widest of the halves' lines, line by line. `extra` is what the right half's head carries beyond its own
 *  text: the refresh button's touch box and the state or the reading's time beside it. */
export function widest(halves: HalfText[], extra?: { refresh?: boolean; state?: string }): Room {
  const most: Room = { head: 0, row: 0, big: 0, small: 0 };
  for (const x of halves) {
    const right = x.headRight ? ems(x.headRight.text, x.headRight.mono ? 'mono' : 'sans') * (x.headRight.mono ? WEB.aside : WEB.head) : 0;
    const corner = extra?.refresh ? REFRESH_TOUCH + (extra.state ? ems(extra.state, 'sans') * WEB.aside + WEB.headGap : 0) : 0;
    const head = WEB.icon + ems(x.title, 'sans', 700) * WEB.head + right + corner + WEB.chev + (x.headRight ? 4 : 3) * WEB.headGap;
    const big = ems(x.big, 'mono') * WEB.fig + ems(x.unit, 'sans') * WEB.aside + WEB.gap;
    const small = (ems(x.value, 'mono') + 0.6 + ems(x.word, 'mono')) * WEB.aside;
    most.head = Math.max(most.head, head);
    most.row = Math.max(most.row, big + small + 2 * WEB.gap);
    most.big = Math.max(most.big, big);
    most.small = Math.max(most.small, small);
  }
  return most;
}

/** The theme's colours are strings; the widget's own type wants a `#` or an `rgba()`. */
const paint = (colour: string) => colour as ColorProp;

/** The providers' colours in the server's order, as the Analytics screen draws them. */
export const SERIES: ColorProp[] = [
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
export const TOOL_COLORS: ColorProp[] = [colors.series1, colors.series5, colors.series6].map(paint);

/** A hex colour's channels: `#ddd` and `#a0a0a0` alike; anything else is not ours to mix. */
function rgb(hex: string): number[] | null {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!h) return null;
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/**
 * The card's small words: the theme's dim ink taken a third of the way to its
 * ink. The web's dim grey is drawn on a lit screen next to the rest of a page;
 * on a home screen it is all the words there are, and at the dim itself they
 * read as faint.
 */
export function softInk(): string {
  const a = rgb(colors.inkDim);
  const b = rgb(colors.ink);
  if (!a || !b) return colors.inkDim;
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) / 3).toString(16).padStart(2, '0')).join('')}`;
}

/** The web card's own icons (cc-usage.ts MODELS_ICON, cc-tools.ts WRENCH and CHEVRON), path for path. */
const MODELS_ICON = 'M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM10 10h4v4h-4z';
const WRENCH_ICON = 'M14.5 4.5a4 4 0 0 0-5 5L4 15l2 2 2 2 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z';
const CHEVRON_ICON = 'M10 7l5 5-5 5';

const glyph = (d: string, ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

/** Everything the drawing measures, from the box the launcher gave it. */
export interface Metrics {
  s: number;
  /** The small figure in a row of its own, under the big one. */
  stacked: boolean;
  pad: number;
  cardPad: number;
  gap: number;
  headFont: number;
  figFont: number;
  smallFont: number;
  /** The head's own aside, "88/298": the asides' size at the head's scale. */
  headAside: number;
  /** The lines those fonts take: a widget is an image, so every box is ours to count. */
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

/** What a half keeps clear beside its widest line, in dp: room for a renderer's rounding, not a band of nothing. */
const MARGIN = 3;
/** The least height the chart keeps in a short cell, in dp. */
const MIN_CHART = 26;

export function metrics(w: number, h: number, room: Room): Metrics {
  const pad = PLATE_PAD;
  // A half's room inside the plate and the card's own borders.
  const half = (w - 2 * pad - 2) / 2;
  // What the card's lines take in height at a scale of 1, with the two gaps
  // between them and the chart: the figures in one row as the web has them, or
  // in two.
  const lines = 2 * WEB.pad + WEB.head * BOX.title.tall + WEB.fig * BOX.figure.tall + 2 * WEB.gap;
  const fit = (across: number, down: number) =>
    Math.max(0.7, Math.min(2, (half - MARGIN) / (across + 2 * WEB.pad), (h - 2 * pad - 2 - MIN_CHART) / down));
  /**
   * The figures are enlarged as far as their widest line - worked out from the
   * very words and figures the card is about to write - still fits its half
   * with `MARGIN` to spare, and only held where a short cell would leave the
   * chart less than `MIN_CHART`. In the web's one row ("10.12k this week 33
   * tools") that is a figure of 13dp in the Samsung's 362: every word of the
   * row shares the width. Where the cell is tall enough, the small figure takes
   * a row of its own under the big one, and the figures grow by half again -
   * 20dp in the same cell, 21 at 390 - while a 320x110 cell, which has no
   * height to give, keeps the web's one row.
   */
  const one = fit(room.row, lines);
  const two = fit(Math.max(room.big, room.small), lines + WEB.aside * BOX.figure.tall);
  const stacked = two > one;
  const k = stacked ? two : one;
  const of = (v: number, by = k) => Math.round(v * by * 10) / 10;
  const cardPad = of(WEB.pad);
  const gap = of(WEB.gap);
  // The head follows the figures, as far as its own line fits: a long word at
  // its right ("this month") makes the head a step smaller, never the figures.
  const kh = Math.min(k, (half - MARGIN - 2 * cardPad) / room.head);
  const headFont = of(WEB.head, kh);
  const figFont = of(WEB.fig);
  const smallFont = of(WEB.aside);
  const headAside = of(WEB.aside, kh);
  // The lines as Android boxes them (`BOX`): the head as tall as its tallest
  // word, the figures' row as its big figure, the small figure's own row as it.
  const headLine = Math.max(tall('title', headFont), tall('word', headFont), tall('figure', headAside));
  const figLine = tall('figure', figFont);
  const smallLine = tall('figure', smallFont);
  // What the head, the figures and the two gaps between the lines take: the
  // chart is the rest, so a taller cell is a taller chart, not a band of nothing.
  const chart = Math.max(
    16,
    Math.round(h - 2 * pad - 2 - 2 * cardPad - headLine - figLine - (stacked ? smallLine : 0) - 2 * gap),
  );
  return {
    s: k,
    stacked,
    pad,
    cardPad,
    gap,
    headFont,
    figFont,
    smallFont,
    headAside,
    headLine,
    figLine,
    smallLine,
    icon: of(WEB.icon, kh),
    chev: of(WEB.chev, kh),
    radius: CARD_RADIUS,
    plateRadius: CORNER,
    chart,
    barGap: of(WEB.barGap),
    innerLeft: half - 2 * cardPad,
    innerRight: half - 1 - 2 * cardPad,
    headGap: of(WEB.headGap, kh),
    figGap: gap,
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
  lift: up = 0,
  font = m.smallFont,
  tight = false,
}: {
  value: string;
  word?: string;
  m: Metrics;
  /** How far it stands above the row's foot: onto the big figure's baseline, in the web's one row. */
  lift?: number;
  /** Its size: the figures' small one, or the head's when it stands in the head. */
  font?: number;
  /** No air between them: a slash waits for its number, as in the web's `88/298`. */
  tight?: boolean;
}) {
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingBottom: up,
        // The web puts a space between them, and in the monospace face that is 0.6em.
        flexGap: tight ? 0 : Math.round(font * 0.6),
      }}
    >
      <TextWidget
        text={value}
        maxLines={1}
        style={{ fontSize: font, ...FACE.figure, color: paint(colors.ink) }}
      />
      {word ? (
        <TextWidget
          text={word}
          maxLines={1}
          style={{ fontSize: font, ...FACE.aside, color: paint(softInk()) }}
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
/** One day's column: its segments' heights, the heaviest series first (bottom-up). */
export interface BarColumn {
  segments: { height: number; color: ColorProp }[];
}

/** What the chart draws: each bar's width, the air between bars, the floor, and each day's segments. */
export interface BarsPlan {
  bar: number;
  gap: number;
  /** The bars' floor: the last pixel of the chart is the line they stand on. */
  floor: number;
  columns: BarColumn[];
}

/**
 * The chart's arithmetic, worked out once so the widget and the picture of it
 * inside the app (Settings > Home screen widget) draw the same bars.
 */
export function barsPlan(
  days: number[][],
  width: number,
  height: number,
  barGap: number,
  palette: ColorProp[],
): BarsPlan {
  const n = Math.max(1, days.length);
  // The web's columns are `flex: 1`, so they share the width to the last fraction
  // of a dp and the last bar ends flush with the card - a whole number each leaves
  // a strip of nothing at the right.
  const bar = Math.max(2, (width - barGap * (n - 1)) / n);
  const most = Math.max(1, ...days.map((d) => d.reduce((a, v) => a + v, 0)));
  const floor = Math.max(4, height - 1);
  const columns = days.map((day) => {
    // The heaviest series first, so the quietest sits on the baseline: the web chart's stack order, bottom-up.
    const segments = day
      .map((v, j) => ({ v, color: palette[j % palette.length] }))
      .filter((x) => x.v > 0)
      .reverse();
    // The air between the segments comes out of the column before the heights are worked out, so the stack ends on the line.
    const room = Math.max(1, floor - Math.max(0, segments.length - 1));
    return {
      segments: segments.map((x) => ({
        height: Math.max(1, Math.round((x.v / most) * room)),
        color: x.color,
      })),
    };
  });
  return { bar, gap: barGap, floor, columns };
}

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
  const plan = barsPlan(days, width, height, barGap, palette);
  return (
    <FlexWidget style={{ flexDirection: 'column', width, height }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', height: plan.floor, width, flexGap: plan.gap }}>
        {plan.columns.map((column, i) => (
          <FlexWidget key={i} style={{ width: plan.bar, height: plan.floor, flexDirection: 'column', justifyContent: 'flex-end' }}>
            {column.segments.map((x, j) => (
              <FlexWidget
                key={j}
                style={{
                  width: plan.bar,
                  height: x.height,
                  borderRadius: 1,
                  marginBottom: j < column.segments.length - 1 ? 1 : 0,
                  backgroundColor: x.color,
                }}
              />
            ))}
          </FlexWidget>
        ))}
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
  headState,
  refresh,
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
  /** The corner beside the ↻: the reading's time, or what the last attempt did. */
  headState?: React.ReactNode;
  /** The ↻ itself (the right half's): a box a finger can hit, drawn on the head's own line. */
  refresh?: React.ReactNode;
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
          style={{ fontSize: m.headFont, ...FACE.title, color: paint(colors.ink) }}
        />
        <FlexWidget style={{ flex: 1 }} />
        {headRight}
        {headState}
        {refresh}
        {divider ? (
          <SvgWidget
            svg={glyph(CHEVRON_ICON, colors.inkDim)}
            style={{ width: m.chev, height: m.chev }}
          />
        ) : null}
      </FlexWidget>
      {/* The figures: the web's one row, or - in a cell with the height for it -
          the small figure in a row of its own under the big one, so both can be
          drawn larger. */}
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        <FlexWidget
          style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: m.figGap, width: 'match_parent' }}
        >
          <TextWidget
            text={big}
            maxLines={1}
            style={{ fontSize: m.figFont, ...FACE.figure, color: paint(colors.ink) }}
          />
          <TextWidget
            text={unit}
            maxLines={1}
            style={{
              fontSize: m.smallFont,
              paddingBottom: lift('word', m.smallFont, 'figure', m.figFont),
              ...FACE.word,
              color: paint(softInk()),
            }}
          />
          {m.stacked ? null : <FlexWidget style={{ flex: 1 }} />}
          {m.stacked ? null : figRight}
        </FlexWidget>
        {m.stacked ? figRight : null}
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

/**
 * The two halves' own words and figures - what the widget writes, and what a
 * picture of it inside the app writes too (Settings > Home screen widget), so
 * the two cannot say different things.
 */
export function widgetTexts(snap: WidgetSnapshot, t: SettingsStrings): { models: HalfText; tools: HalfText } {
  const models: HalfText = {
    title: t.models,
    headRight: { text: t.period.month, mono: false },
    big: figure(snap.models.tokens),
    unit: 'tok',
    value: count(snap.models.calls),
    word: t.calls,
  };
  const hasMonth = snap.tools.month !== undefined;
  const countVal = hasMonth ? snap.tools.month! : snap.tools.week;
  const tools: HalfText = {
    title: t.tools,
    // The web head's "88/298" - the tools that are on, out of all of them.
    headRight: snap.tools.total ? { text: `${snap.tools.on}/${count(snap.tools.total)}`, mono: true } : undefined,
    big: countVal >= 1e4 ? figure(countVal) : String(countVal),
    unit: hasMonth ? t.period.month : t.period.week,
    value: count(snap.tools.kinds),
    word: t.toolWord(snap.tools.kinds),
  };
  return { models, tools };
}

export function StatsWidget({
  snap,
  w,
  h,
  t,
  lang = 'en',
  state = {},
  staleAfter = STALE_MS,
  now = Date.now(),
}: {
  snap: WidgetSnapshot | null;
  /** The widget's own size, in dp: every measure here is worked out from it. */
  w: number;
  h: number;
  t: SettingsStrings;
  /** The words' language: the reading's time is written in it. */
  lang?: UiLang;
  /** What it is doing: refreshing (the button was pressed) or failed (the last attempt did not come back). */
  state?: WidgetState;
  /** A reading older than this is drawn in the warning tone, in its corner. */
  staleAfter?: number;
  /** The clock its corner reads against (a picture of the widget in the app passes its own). */
  now?: number;
}) {
  // The text each half writes, worked out once: the drawing below writes it and
  // `widest` sizes the card to it.
  const texts = snap ? widgetTexts(snap, t) : null;
  const models: HalfText = texts?.models ?? { title: t.models, big: '', unit: '', value: '', word: '' };
  const tools: HalfText = texts?.tools ?? { title: t.tools, big: '', unit: '', value: '', word: '' };
  // The corner's own words: what the state says, or the reading's time. Measured with the rest, so a long one
  // makes the head a step smaller rather than pushing the figures out.
  // The corner is a few dp wide: the states are said in one word (their labels carry the long ones).
  const corner = state.refreshing ? t.widgetRefreshingShort : state.failed ? t.widgetFailedShort
    : snap ? whenText(snap.at, t, lang, now) : '';
  const stale = !!snap && isStale(snap.at, now, staleAfter);
  const m = metrics(w, h, widest(snap ? [models, tools] : [{ ...models, big: '', unit: '', value: '', word: '' }],
    { refresh: true, state: corner }));
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
            style={{ fontSize: m.headFont, ...FACE.title, color: paint(colors.ink) }}
          />
          <TextWidget
            text={t.nothing}
            maxLines={1}
            style={{ fontSize: m.smallFont, ...FACE.word, color: paint(softInk()) }}
          />
        </FlexWidget>
      </FlexWidget>
    );
  }
  return (
    <FlexWidget style={plate} clickAction="OPEN_APP" accessibilityLabel={label}>
      <FlexWidget style={card}>
        <Half
          icon={glyph(MODELS_ICON, softInk())}
          title={models.title}
          headRight={
            <TextWidget
              text={t.period.month}
              maxLines={1}
              style={{ fontSize: m.headFont, ...FACE.word, color: paint(softInk()) }}
            />
          }
          big={models.big}
          unit={models.unit}
          figRight={<Figure value={models.value} word={models.word} m={m} lift={m.stacked ? 0 : lift('figure', m.smallFont, 'figure', m.figFont)} />}
          days={snap.models.days}
          palette={SERIES}
          width={m.innerLeft}
          m={m}
          label={`${t.models}: ${compact(snap.models.tokens)} tok, ${count(snap.models.calls)} ${t.calls}`}
        />

        <Half
          icon={glyph(WRENCH_ICON, softInk())}
          title={tools.title}
          headRight={
            // The head is a few dp wide: when it has something to say about the refresh, that is what it says -
            // the tools' own 88/298 waits for the next drawing.
            snap.tools.total && !state.refreshing && !state.failed ? (
              <Figure value={String(snap.tools.on)} word={`/${count(snap.tools.total)}`} m={m} font={m.headAside} tight />
            ) : null
          }
          headState={
            corner ? (
              <FlexWidget
                style={{ flexDirection: 'row', alignItems: 'center', flexGap: 2 }}
                accessibilityLabel={state.refreshing ? t.widgetRefreshing : state.failed ? t.widgetFailed : undefined}
              >
                {state.failed ? (
                  <SvgWidget svg={glyph(WARN_ICON, colors.warn)} style={{ width: m.headAside, height: m.headAside }} />
                ) : null}
                <TextWidget
                  text={corner}
                  maxLines={1}
                  style={{
                    fontSize: m.headAside,
                    ...FACE.aside,
                    color: paint(state.failed || stale ? colors.warn : softInk()),
                  }}
                />
              </FlexWidget>
            ) : null
          }
          refresh={
            // The button: its mark twelve dp, its box forty - and the box's own height pulled back into the head
            // row's, so the corner costs the chart nothing.
            <FlexWidget
              clickAction="REFRESH"
              accessibilityLabel={t.widgetRefresh}
              style={{
                width: REFRESH_TOUCH,
                height: REFRESH_TOUCH,
                marginTop: -Math.max(0, (REFRESH_TOUCH - m.headLine) / 2),
                marginBottom: -Math.max(0, (REFRESH_TOUCH - m.headLine) / 2),
                marginRight: -m.headGap,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SvgWidget
                svg={glyph(REFRESH_ICON, state.refreshing ? colors.inkDim : softInk())}
                style={{ width: m.chev, height: m.chev }}
              />
            </FlexWidget>
          }
          big={tools.big}
          unit={tools.unit}
          figRight={<Figure value={tools.value} word={tools.word} m={m} lift={m.stacked ? 0 : lift('figure', m.smallFont, 'figure', m.figFont)} />}
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
