/**
 * The refresh Android does by itself, past the widget's own thirty minutes.
 *
 * `updatePeriodMillis` is the launcher's, and it is the *least* a widget may be
 * told (30 minutes): in Doze, or under a manufacturer's battery restrictions, it
 * is not run at all for hours. So the same reading is fetched by a background
 * task as well - `expo-background-task` (WorkManager on Android, Expo 57's own
 * package), whose least interval is 15 minutes and which Android runs when the
 * phone is not asleep; its work is a refresh of the widget (`refreshWidget`), so
 * the app's own, a click and this share one lock, one throttle and one log.
 *
 * `expo-background-fetch` was the older package for this and is deprecated in
 * Expo 57 (it maps onto BackgroundTask anyway); this app is on 57 and uses the
 * one the SDK keeps.
 *
 * The two packages are loaded the first time they are needed, not when this file
 * is imported: a settings page, a jest run or the web build must not fail
 * because a phone-only module is missing. Nothing here throws: registering is
 * best effort (a device may refuse background work), and the widget keeps the
 * launcher's own updates either way.
 */
import { Platform } from 'react-native';

import { refreshWidget } from './refresh';
import { writeRefreshLog } from './log';

/** The task's name, as Android keeps it. */
export const WIDGET_TASK = 'workbench-widget-refresh';
/** The least interval WorkManager takes, in minutes. */
export const WIDGET_TASK_MINUTES = 15;

type Bg = typeof import('expo-background-task');
type Tm = typeof import('expo-task-manager');

function libs(): { background: Bg; tasks: Tm } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const background = require('expo-background-task') as Bg;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tasks = require('expo-task-manager') as Tm;
    return background && tasks ? { background, tasks } : null;
  } catch {
    return null;
  }
}

/**
 * Defined once, at the app's start (index.ts), before anything is registered: a
 * task that is registered and not defined is a task Android runs and loses.
 */
export function defineWidgetBackgroundTask(): void {
  if (Platform.OS !== 'android') return;
  const got = libs();
  if (!got) return;
  const { background, tasks } = got;
  try {
    if (tasks.isTaskDefined(WIDGET_TASK)) return;
    tasks.defineTask(WIDGET_TASK, async () => {
      const at = Date.now();
      try {
        const out = await refreshWidget('background');
        return out.outcome === 'error' ? background.BackgroundTaskResult.Failed : background.BackgroundTaskResult.Success;
      } catch (e) {
        await writeRefreshLog({
          at,
          trigger: 'background',
          outcome: 'error',
          note: e instanceof Error ? e.message : String(e),
        });
        return background.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    // No task manager here: the widget keeps the launcher's updates.
  }
}

/** Ask Android to run it every fifteen minutes or so, while the widget is on the home screen. */
export async function registerWidgetBackground(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const got = libs();
  if (!got) return false;
  try {
    const status = await got.background.getStatusAsync();
    if (status === got.background.BackgroundTaskStatus.Restricted) return false;
    await got.background.registerTaskAsync(WIDGET_TASK, { minimumInterval: WIDGET_TASK_MINUTES });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterWidgetBackground(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const got = libs();
  if (!got) return;
  try {
    await got.background.unregisterTaskAsync(WIDGET_TASK);
  } catch {
    // It was not registered.
  }
}

/** Whether Android allows background work for this app at all ("Restricted" under a manufacturer's rules). */
export async function backgroundAllowed(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  const got = libs();
  if (!got) return null;
  try {
    const status = await got.background.getStatusAsync();
    return status === got.background.BackgroundTaskStatus.Available;
  } catch {
    return null;
  }
}
