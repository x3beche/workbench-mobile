/**
 * Why the home screen widget did or did not refresh: every attempt written down
 * on the device, twenty of them, and read back on Settings > Home screen
 * widget. Android is free to hold a background job back for hours (Doze, a
 * Samsung's battery restrictions) and the widget then looks simply stale with
 * no one to ask; this is where the answer is, after the fact: when it was
 * tried, by what, and how it went.
 *
 * The list lives in AsyncStorage, not in the app's memory: the widget's task
 * runs in a runtime of its own, and the record has to survive it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** What asked for the refresh. */
export type RefreshTrigger = 'added' | 'update' | 'resized' | 'click' | 'app' | 'background' | 'chat';

/** How an attempt ended: the reading came, it failed, or it was not tried (busy, too soon). */
export type RefreshOutcome = 'ok' | 'error' | 'skipped';

export interface RefreshEntry {
  /** When the attempt was made, in ms. */
  at: number;
  trigger: RefreshTrigger;
  outcome: RefreshOutcome;
  /** What went wrong, or why it was passed over - short, for the list. */
  note?: string;
}

const KEY = 'workbench.widget.refreshLog';
/** Kept: the last twenty attempts. */
export const LOG_MAX = 20;

/** Newest first, at most `LOG_MAX`. A failure to read is an empty list, never a crash in a widget task. */
export async function readRefreshLog(): Promise<RefreshEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const got = raw ? (JSON.parse(raw) as RefreshEntry[]) : [];
    return Array.isArray(got) ? got.filter(isEntry).slice(0, LOG_MAX) : [];
  } catch {
    return [];
  }
}

/** One line, written before the work is done so an attempt that killed the runtime is on the list too. */
export async function writeRefreshLog(entry: RefreshEntry): Promise<void> {
  try {
    const list = await readRefreshLog();
    // The same attempt written twice (started, then its outcome) replaces itself.
    const rest = list.filter((e) => !(e.at === entry.at && e.trigger === entry.trigger));
    const next = [{ ...entry, note: shortNote(entry.note) }, ...rest].sort((a, b) => b.at - a.at).slice(0, LOG_MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // No room: the widget still works, only the record of it is missing.
  }
}

/** The outcome of an attempt already begun (its line is in the list, from `writeRefreshLog`). */
export async function settleRefreshLog(at: number, trigger: RefreshTrigger, outcome: RefreshOutcome, note?: string) {
  await writeRefreshLog({ at, trigger, outcome, note });
}

export async function clearRefreshLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

function isEntry(x: unknown): x is RefreshEntry {
  const e = x as RefreshEntry;
  return !!e && typeof e.at === 'number' && typeof e.trigger === 'string'
    && (e.outcome === 'ok' || e.outcome === 'error' || e.outcome === 'skipped');
}

/** A note as long as a list row can hold: one line, a hundred characters. */
function shortNote(note?: string): string | undefined {
  if (!note) return undefined;
  const one = note.replace(/\s+/g, ' ').trim();
  return one.length > 100 ? `${one.slice(0, 99)}…` : one;
}
