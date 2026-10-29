/**
 * Keeping the home screen widget current while the app is open: the Analytics
 * screen has these two readings anyway, so each time it loads them the widget
 * is redrawn from what it just read - no second request, and the widget follows
 * the conversation as the cards on the screen do. Android redraws it on its own
 * every thirty minutes afterwards (widget/task.tsx).
 */
import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';

import type { LlmSummary, ToolsUsage } from '../api/types';
import { snapshotOf, type WidgetSnapshot } from './data';
import { saveSnapshot } from './source';
import { StatsWidget } from './StatsWidget';
import { WIDGET_NAME } from './task';
import { widgetWords } from './words';

export async function pushWidget(summary: LlmSummary, tools: ToolsUsage): Promise<void> {
  const snap: WidgetSnapshot = snapshotOf(summary, tools);
  await saveSnapshot(snap);
  const { t } = await widgetWords();
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (info) => <StatsWidget snap={snap} w={info.width} h={info.height} t={t} />,
    });
  } catch {
    // No widget on the home screen: nothing to draw, and nothing to say about it.
  }
}
