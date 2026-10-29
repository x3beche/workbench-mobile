/**
 * Whether the figures are on the home screen, and the launcher's own prompt to
 * put them there (Settings > Home screen widget). Android only: elsewhere the
 * library answers zero and false, and Settings says the widget is Android's.
 */
import { useEffect, useState } from 'react';
import { getWidgetInfo, requestPinWidget } from 'react-native-android-widget';

import { WIDGET_NAME } from './task';

/** How many of the figures' cards the launcher says are on the home screen; null when it cannot say. */
export function useWidgetsOnHome(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    getWidgetInfo(WIDGET_NAME).then(
      (found) => live && setCount(found.length),
      () => live && setCount(null),
    );
    return () => {
      live = false;
    };
  }, []);
  return count;
}

/** The launcher's "add this widget" prompt; false where the launcher does not offer one. */
export async function addWidget(): Promise<boolean> {
  try {
    return await requestPinWidget({ widgetName: WIDGET_NAME });
  } catch {
    return false;
  }
}
