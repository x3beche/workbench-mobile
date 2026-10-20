/**
 * A thread read a page at a time (a room's lines, ten at a time): the newest
 * page read again and laid over what is held, and an older page put before
 * it. Lines are told apart by their id.
 */

/** How many lines a page holds. */
export const PAGE = 10;

interface HasId {
  id: string;
}

/**
 * The newest page laid over what is held: the lines before where it starts
 * are kept, the page replaces the rest (so a line read again - now seen, or
 * edited - is the page's). `gap` when the page does not reach back to what
 * is held (more was written since than a page holds): then only the page is
 * kept, and what came before it is to be read again a page at a time.
 */
export function layLatest<T extends HasId>(held: T[] | null, latest: T[], page = PAGE): { lines: T[]; gap: boolean } {
  if (!held || !held.length || !latest.length) return { lines: latest, gap: false };
  const at = held.findIndex((l) => l.id === latest[0].id);
  if (at >= 0) return { lines: [...held.slice(0, at), ...latest], gap: false };
  // The page starts before anything held: the whole thread is in it.
  if (latest.length < page) return { lines: latest, gap: false };
  // It reaches back past everything held (lines were taken back): it is all there is.
  if (latest.some((l) => held.some((h) => h.id === l.id))) return { lines: latest, gap: false };
  return { lines: latest, gap: true };
}

/** An older page put before what is held; `added` 0 when it brought nothing new (the start was reached). */
export function putOlder<T extends HasId>(held: T[], older: T[]): { lines: T[]; added: number } {
  const known = new Set(held.map((l) => l.id));
  const fresh = older.filter((l) => !known.has(l.id));
  return { lines: fresh.length ? [...fresh, ...held] : held, added: fresh.length };
}
