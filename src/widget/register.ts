/**
 * The widget's task handler is registered once, at start-up, in the app's own
 * entry (index.ts): Android starts that bundle headless when a widget needs a
 * drawing, so the handler has to be there before any screen is.
 */
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { defineWidgetBackgroundTask } from './background';
import { widgetTaskHandler } from './task';

export function registerWidgets(): void {
  registerWidgetTaskHandler(widgetTaskHandler);
  // Defined before anything registers it: Android keeps a registered task's name, not its code.
  defineWidgetBackgroundTask();
}
