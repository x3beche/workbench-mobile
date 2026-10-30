/**
 * What Android asks of the widget, and what its own button asks.
 *
 * - When it is put on the home screen (WIDGET_ADDED) or its thirty minutes are
 *   up (WIDGET_UPDATE): the reading is fetched, kept and drawn - and written into
 *   `widget/log.ts`, so a refresh that never happened says why.
 * - When it is resized (WIDGET_RESIZED): the reading it already has is drawn in
 *   the new box, no network.
 * - When it is tapped: a tap on the ↻ (`clickAction="REFRESH"`) refreshes it; a
 *   tap anywhere else is the launcher's own OPEN_APP and comes here only to be
 *   told it is not ours to draw.
 *
 * The handler may only draw through `renderWidget` (the launcher has already
 * started a draw and waits for it), so a refresh it asks for goes through
 * `loadForTask` and is drawn here; the app's own refreshes go through
 * `refresh.ts`'s `refreshWidget` and draw themselves.
 */
'use no memo';
import React from 'react';
import type { WidgetTaskHandler } from 'react-native-android-widget';

import { StatsWidget, type WidgetState } from './StatsWidget';
import { loadForTask, refreshWidget } from './refresh';
import { readSnapshot } from './source';
import { WIDGET_NAME } from './name';
import { widgetWords } from './words';

export { WIDGET_NAME };

/** The reading is older than this: the card says so in its corner (2 h). */
export const STALE_MS = 2 * 3600_000;

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, widgetInfo, clickAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK') {
    // The refresh button is ours; every other tap is the frame's OPEN_APP, which the launcher has already
    // acted on.
    if (clickAction === 'REFRESH') await refreshWidget('click', { showProgress: true });
    return;
  }
  const { t, lang } = await widgetWords();
  const trigger = widgetAction === 'WIDGET_ADDED' ? 'added'
    : widgetAction === 'WIDGET_RESIZED' ? 'resized'
      : 'update';
  const snap = await loadForTask(trigger);
  const state: WidgetState = { failed: !snap };
  renderWidget(
    <StatsWidget
      snap={snap}
      w={widgetInfo.width}
      h={widgetInfo.height}
      t={t}
      lang={lang}
      state={state}
      staleAfter={STALE_MS}
    />,
  );
};

/** The empty card, for the times a reading cannot be had at all. */
export async function drawEmpty(): Promise<null> {
  await readSnapshot();
  return null;
}
