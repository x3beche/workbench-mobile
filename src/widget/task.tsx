/**
 * What Android asks of the widget: draw it when it is put on the home screen
 * (WIDGET_ADDED), when its own thirty minutes are up (WIDGET_UPDATE), and when
 * it is resized (WIDGET_RESIZED). Each of those reads the server as the account
 * last signed in and draws what came back; a resized widget takes the reading
 * it already has, so dragging its edge does not wait on the network, and a
 * reading that cannot be fetched now falls back to the last one kept.
 */
'use no memo';
import React from 'react';
import type { WidgetTaskHandler } from 'react-native-android-widget';

import { StatsWidget } from './StatsWidget';
import { fetchSnapshot, readSnapshot, saveSnapshot } from './source';
import { widgetWords } from './words';

/** The name the config plugin gave it (app.json), and the one updates are asked for. */
export const WIDGET_NAME = 'Stats';

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, widgetInfo, renderWidget }) => {
  // A tap is the launcher's (the frame opens the app, not this): nothing to draw.
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const { t } = await widgetWords();
  let snap = widgetAction === 'WIDGET_RESIZED' ? await readSnapshot() : null;
  if (!snap) {
    snap = await fetchSnapshot().catch(() => null);
    if (snap) await saveSnapshot(snap);
    else snap = await readSnapshot();
  }
  renderWidget(<StatsWidget snap={snap} w={widgetInfo.width} h={widgetInfo.height} t={t} />);
};
