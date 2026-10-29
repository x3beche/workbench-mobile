/**
 * The home screen widget: the web Chat tab's two cards - the models' month and
 * the tools' week, each with its last 14 days - as one frame split by a
 * hairline, at the size the launcher hands us (5x2 cells, 320x110 dp).
 *
 * It is drawn from primitives only (FlexWidget, TextWidget, SvgWidget): the
 * library renders a widget to an image, so nothing here may use a hook, a
 * context, an async call or any of the app's own views. What it shows arrives
 * as props - the snapshot the task handler read (data.ts), the widget's own
 * size in dp, and the words of the language it was drawn in.
 */
'use no memo';
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import { compact } from '../lib/numbers';
import type { SettingsStrings } from '../lib/settingsStrings';
import { colors } from '../theme/tokens';
import type { WidgetSnapshot } from './data';

/** The chart's height under the figures, the web card's 34 - less on a short widget. */
const CHART = 34;
/** What the head, the figures and their gaps take above the chart, padding included. */
const ABOVE = 56;
/** A bar's gap, and its least width: 14 bars must fit in half the widget. */
const BAR_GAP = 2;
const BAR_MIN = 2;

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

const cpu = (ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/></svg>`;
const wrench = (ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z"/><path d="M18 3l3 3"/></svg>`;
const chevron = (dim: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${dim}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 7l5 5-5 5"/></svg>`;

/** The 14 days as bars: each a row of stacked segments, bottom-up, in its series' colours. */
function Bars({
  days,
  width,
  height,
  palette,
}: {
  days: number[][];
  width: number;
  height: number;
  palette: ColorProp[];
}) {
  const n = Math.max(1, days.length);
  const bar = Math.max(BAR_MIN, Math.floor((width - BAR_GAP * (n - 1)) / n));
  const most = Math.max(1, ...days.map((d) => d.reduce((a, v) => a + v, 0)));
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', height, width, flexGap: BAR_GAP }}>
      {days.map((day, i) => {
        // The heaviest series first, so the quietest sits on the baseline: the web chart's stack order, bottom-up.
        const segments = day
          .map((v, j) => ({ v, color: palette[j % palette.length] }))
          .filter((s) => s.v > 0)
          .reverse();
        return (
          <FlexWidget
            key={i}
            style={{ width: bar, height, flexDirection: 'column', justifyContent: 'flex-end' }}
          >
            {segments.map((s, j) => (
              <FlexWidget
                key={j}
                style={{
                  width: bar,
                  height: Math.max(1, Math.round((s.v / most) * height)),
                  backgroundColor: s.color,
                }}
              />
            ))}
          </FlexWidget>
        );
      })}
    </FlexWidget>
  );
}

/** One half: its icon and name, what the head says at the right, the large figure, the chart. */
function Half({
  icon,
  title,
  head,
  big,
  unit,
  right,
  days,
  palette,
  width,
  height,
  label,
}: {
  icon: string;
  title: string;
  head: string;
  big: string;
  unit: string;
  right: string;
  days: number[][];
  palette: ColorProp[];
  width: number;
  height: number;
  label: string;
}) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        height: 'match_parent',
        padding: 7,
        flexDirection: 'column',
        flexGap: 4,
        backgroundColor: paint(colors.surface),
      }}
      accessibilityLabel={label}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5, width: 'match_parent' }}>
        <SvgWidget svg={icon} style={{ width: 13, height: 13 }} />
        <TextWidget text={title} maxLines={1} style={{ fontSize: 11, fontWeight: '600', color: paint(colors.ink) }} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget text={head} maxLines={1} style={{ fontSize: 11, color: paint(colors.inkDim) }} />
        <SvgWidget svg={chevron(colors.inkDim)} style={{ width: 11, height: 11 }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 4, width: 'match_parent' }}>
        <TextWidget
          text={big}
          maxLines={1}
          style={{ fontSize: 15, fontWeight: '600', fontFamily: MONO, color: paint(colors.ink) }}
        />
        <TextWidget text={unit} maxLines={1} style={{ fontSize: 11, color: paint(colors.inkDim) }} />
        <FlexWidget style={{ flex: 1 }} />
        {right ? (
          <TextWidget
            text={right}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, fontFamily: MONO, color: paint(colors.inkDim) }}
          />
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ flex: 1 }} />
      <Bars days={days} width={width} height={height} palette={palette} />
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
  /** The widget's own size, in dp: the halves' bars are laid out from it. */
  w: number;
  h: number;
  t: SettingsStrings;
}) {
  // One sentence for a screen reader: the widget itself is a picture to it.
  const label = snap
    ? `${t.models}, ${t.period.month}: ${compact(snap.models.tokens)} tok, ${count(snap.models.calls)} ${t.calls}. ${t.tools}, ${t.period.week}: ${count(snap.tools.week)}, ${t.toolCount(snap.tools.kinds)}.`
    : `${t.models} · ${t.tools}. ${t.nothing}`;
  // The frame's own border and the hairline between the halves come off first, then each half's padding.
  const inner = Math.max(0, Math.floor((w - 3) / 2) - 14);
  const chart = Math.max(20, Math.min(CHART, h - ABOVE));
  if (!snap) {
    return (
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
          borderWidth: 1,
          borderColor: paint(colors.line),
          borderRadius: 6,
          backgroundColor: paint(colors.surface),
          padding: 7,
          flexDirection: 'column',
          flexGap: 4,
          justifyContent: 'center',
        }}
        clickAction="OPEN_APP"
        accessibilityLabel={label}
      >
        <TextWidget text={`${t.models} · ${t.tools}`} maxLines={1} style={{ fontSize: 11, fontWeight: '600', color: paint(colors.ink) }} />
        <TextWidget text={t.nothing} maxLines={1} style={{ fontSize: 11, color: paint(colors.inkDim) }} />
      </FlexWidget>
    );
  }
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        borderWidth: 1,
        borderColor: paint(colors.line),
        borderRadius: 6,
        backgroundColor: paint(colors.surface),
        flexDirection: 'row',
      }}
      clickAction="OPEN_APP"
      accessibilityLabel={label}
    >
      <Half
        icon={cpu(colors.inkDim)}
        title={t.models}
        head={t.period.month}
        big={compact(snap.models.tokens)}
        unit="tok"
        right={`${count(snap.models.calls)} ${t.calls}`}
        days={snap.models.days}
        palette={SERIES}
        width={inner}
        height={chart}
        label={`${t.models}: ${compact(snap.models.tokens)} tok, ${count(snap.models.calls)} ${t.calls}`}
      />
      <FlexWidget style={{ width: 1, height: 'match_parent', backgroundColor: paint(colors.line) }} />
      <Half
        icon={wrench(colors.inkDim)}
        title={t.tools}
        head={t.toolCount(snap.tools.kinds)}
        big={snap.tools.week >= 1e4 ? count(snap.tools.week) : String(snap.tools.week)}
        unit={t.period.week}
        right=""
        days={snap.tools.days}
        palette={TOOL_COLORS}
        width={inner}
        height={chart}
        label={`${t.tools}: ${count(snap.tools.week)} ${t.period.week}, ${t.toolCount(snap.tools.kinds)}`}
      />
    </FlexWidget>
  );
}
