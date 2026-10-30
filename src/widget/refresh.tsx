/**
 * The one way the home screen widget is refreshed, whoever asks for it: the
 * launcher (added, resized, its own thirty minutes), its refresh button, the app
 * coming to the foreground, the background task, and a chat's own send.
 *
 * One door because the things that keep it from misbehaving have to be in one
 * place:
 *
 * - **One at a time.** A second refresh while one is in the air is passed over
 *   (not queued): a finger tapping the ↻ five times is one request, and the
 *   widget is drawn from the reading that arrives anyway.
 * - **Not too often.** A click waits ten seconds, the app's own foreground two
 *   minutes, a chat a minute - kept on the device, so the widget's task and the
 *   app share the same last time.
 * - **Both ends of the wire.** The reading is kept (`saveSnapshot`), so a widget
 *   that cannot reach the server still shows numbers - with the reading's own
 *   time on its head, and `failed` beside the ↻ when the attempt it just made
 *   did not come back.
 * - **Written down.** Every attempt goes into `widget/log.ts`, twenty of them,
 *   read back on Settings > Home screen widget.
 *
 * Nothing here throws: a widget task that throws is a widget that disappears.
 */
import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { StatsWidget, type WidgetState } from './StatsWidget';
import { fetchSnapshot, readSnapshot, saveSnapshot } from './source';
import { settleRefreshLog, writeRefreshLog, type RefreshOutcome, type RefreshTrigger } from './log';
import { WIDGET_NAME } from './name';
import { widgetWords } from './words';
import type { WidgetSnapshot } from './data';

/** How long each kind of ask waits before it may ask again, in ms (0: no such rule). */
const THROTTLE: Record<RefreshTrigger, number> = {
  added: 0,
  update: 0,
  resized: 0,
  click: 10_000,
  chat: 60_000,
  app: 120_000,
  background: 0,
};
/** The last time each kind of ask was *started*, on the device: the app and the widget's task share it, and a
 *  click's own ten seconds do not hold the app's two minutes or the chat's minute back. */
const KEY_LAST = 'workbench.widget.lastRefresh';

export interface RefreshOptions {
  /** A reading the caller already has (Analytics), so nothing is asked twice. */
  snap?: WidgetSnapshot | null;
  /** Draw the "refreshing" face before the request when the person pressed the button. */
  showProgress?: boolean;
  /** Where this runs: the launcher's task may only draw through `renderWidget`, never request an update. */
  quiet?: boolean;
}

export interface RefreshResult {
  outcome: RefreshOutcome;
  /** What the widget ended up showing: the new reading, or the one it had. */
  snap: WidgetSnapshot | null;
  /** The attempt's own time (its line in the log). */
  at: number;
}

/** One at a time, for the whole runtime - the app's and the widget task's alike. Taken before the first
 *  `await` (a tap's promise starts running the moment it is made), so three taps in one frame are one
 *  refresh and two "already refreshing" lines. */
let busy = false;

/** When this kind of ask last ran (0: never). */
export async function lastRefreshAt(trigger?: RefreshTrigger): Promise<number> {
  try {
    const all = await readStored();
    if (!trigger) return all[trigger ?? 'app'] ?? 0;
    return all[trigger] ?? 0;
  } catch {
    return 0;
  }
}

export async function refreshWidget(trigger: RefreshTrigger, opts: RefreshOptions = {}): Promise<RefreshResult> {
  const at = Date.now();
  const skip = async (why: string): Promise<RefreshResult> => {
    await writeRefreshLog({ at, trigger, outcome: 'skipped', note: why });
    return { outcome: 'skipped', snap: await readSnapshot(), at };
  };
  if (busy) return skip('already refreshing');
  busy = true;
  try {
  const last = await lastRefreshAt(trigger);
  const wait = THROTTLE[trigger] ?? 0;
  if (wait && at - last < wait) return await skip(`not yet: ${Math.round((wait - (at - last)) / 1000)} s to go`);

  const run = async (): Promise<RefreshResult> => {
    await writeRefreshLog({ at, trigger, outcome: 'skipped', note: 'running' });
    await storeLast(trigger, at);
    const before = await readSnapshot();
    // The button was pressed: say so in the corner at once, from the reading it already has.
    if (opts.showProgress && !opts.quiet) await draw(before, { refreshing: true });
    try {
      const snap = opts.snap ?? (await fetchSnapshot());
      if (!snap) throw new Error('no account, or nothing came back');
      await saveSnapshot(snap);
      if (!opts.quiet) await draw(snap, {});
      await settleRefreshLog(at, trigger, 'ok');
      return { outcome: 'ok', snap, at };
    } catch (e) {
      const note = e instanceof Error ? e.message : String(e);
      // The reading it had stays: an old number with its time is worth more than none.
      if (!opts.quiet) await draw(before, { failed: true });
      await settleRefreshLog(at, trigger, 'error', note);
      return { outcome: 'error', snap: before, at };
    }
  };
  return await run();
  } finally {
    busy = false;
  }
}

/**
 * A refresh asked for from the launcher's own task: it must not call
 * `requestWidgetUpdate` (the launcher has already started a draw and waits for
 * `renderWidget`), so the reading is fetched, kept and handed back.
 */
export async function loadForTask(trigger: RefreshTrigger): Promise<WidgetSnapshot | null> {
  const at = Date.now();
  if (trigger === 'resized') {
    // Dragging its edge is not news: the reading it has, drawn in the new box.
    await writeRefreshLog({ at, trigger, outcome: 'ok', note: 'kept' });
    return readSnapshot();
  }
  if (busy) {
    await writeRefreshLog({ at, trigger, outcome: 'skipped', note: 'already refreshing' });
    return readSnapshot();
  }
  busy = true;
  try {
  const run = async (): Promise<WidgetSnapshot | null> => {
    await writeRefreshLog({ at, trigger, outcome: 'skipped', note: 'running' });
    await storeLast(trigger, at);
    try {
      const snap = await fetchSnapshot();
      if (!snap) throw new Error('no account, or nothing came back');
      await saveSnapshot(snap);
      await settleRefreshLog(at, trigger, 'ok');
      return snap;
    } catch (e) {
      const note = e instanceof Error ? e.message : String(e);
      await settleRefreshLog(at, trigger, 'error', note);
      return readSnapshot();
    }
  };
  return await run();
  } finally {
    busy = false;
  }
}

/** Draw the widget from a reading (none: the empty card), in whatever state it is in. */
export async function draw(snap: WidgetSnapshot | null, state: WidgetState = {}): Promise<boolean> {
  const { t, lang } = await widgetWords();
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (info) => <StatsWidget snap={snap} w={info.width} h={info.height} t={t} lang={lang} state={state} />,
    });
    return true;
  } catch {
    // No widget on the home screen: nothing to draw, and nothing to say about it.
    return false;
  }
}

async function readStored(): Promise<Partial<Record<RefreshTrigger, number>>> {
  const raw = await AsyncStorage.getItem(KEY_LAST);
  if (!raw) return {};
  const got = JSON.parse(raw) as Record<string, number>;
  return Object.fromEntries(Object.entries(got ?? {}).filter(([, v]) => typeof v === 'number')) as Partial<
    Record<RefreshTrigger, number>
  >;
}

async function storeLast(trigger: RefreshTrigger, at: number): Promise<void> {
  try {
    const all = await readStored();
    await AsyncStorage.setItem(KEY_LAST, JSON.stringify({ ...all, [trigger]: at }));
  } catch {
    // The throttle then only counts this runtime's own attempts.
  }
}
