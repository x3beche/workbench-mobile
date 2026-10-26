/**
 * The drawer's session groups (Claude sessions, OpenCode sessions) folded
 * and pinned as the web app's Chat list does it (frontend/src/app/rooms/
 * claude-sessions.ts ListFold): the person's choice is kept on the server
 * (GET /api/me/side, PUT /api/me/side/pins and /folds), so it is the same on
 * the web, on this phone and on any other. Until a group was folded or
 * opened by hand, it is open while a session in it is live or open. Pinned
 * sessions come first, in the order they were pinned, and stay in sight while
 * the group is folded; an open group shows the pinned ones, the newest
 * FOLD_FIRST and the open one, with "Show N more".
 */
import type { SideGroup, SidePrefs } from '../api/types';

export const FOLD_FIRST = 5;

export const SIDE_EMPTY: SidePrefs = {
  pins: { claude: [], opencode: [] },
  folds: { claude: null, opencode: null },
};

/** Open or folded: the person's choice, else the default (`auto`: a session in it is live or open, or a search is on). */
export function isOpen(prefs: SidePrefs, g: SideGroup, auto: boolean): boolean {
  return prefs.folds[g] ?? auto;
}

export function isPinned(prefs: SidePrefs, g: SideGroup, id: string): boolean {
  return prefs.pins[g].includes(id);
}

/** Pinned first (in the order they were pinned), then the rest as they came. */
export function pinnedFirst<T>(prefs: SidePrefs, g: SideGroup, rows: T[], id: (r: T) => string): T[] {
  const pins = prefs.pins[g];
  const at = (r: T) => {
    const i = pins.indexOf(id(r));
    return i < 0 ? Infinity : i;
  };
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => at(a.r) - at(b.r) || a.i - b.i)
    .map((x) => x.r);
}

/** What a group shows: folded, only the pinned; open, the pinned, the first FOLD_FIRST and the open one (all with `more`). */
export function visibleRows<T>(
  prefs: SidePrefs,
  g: SideGroup,
  rows: T[],
  id: (r: T) => string,
  open: boolean,
  selected: string | null,
  all: boolean,
): T[] {
  const ordered = pinnedFirst(prefs, g, rows, id);
  if (!open) return ordered.filter((r) => isPinned(prefs, g, id(r)));
  if (all) return ordered;
  let n = 0;
  return ordered.filter((r) => isPinned(prefs, g, id(r)) || id(r) === selected || n++ < FOLD_FIRST);
}

/** A pin set or taken off here at once, before the server answers (newest pin first, as the server keeps them). */
export function withPin(prefs: SidePrefs, g: SideGroup, id: string, pinned: boolean): SidePrefs {
  const list = prefs.pins[g].filter((x) => x !== id);
  return { ...prefs, pins: { ...prefs.pins, [g]: pinned ? [id, ...list] : list } };
}

export function withFold(prefs: SidePrefs, g: SideGroup, open: boolean | null): SidePrefs {
  return { ...prefs, folds: { ...prefs.folds, [g]: open } };
}
