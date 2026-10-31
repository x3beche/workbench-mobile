/**
 * One's own agents as one group in the drawer - the Claude Code sessions and the OpenCode sessions - and the
 * sessions a person put under another drawn under it as a tree, as the web's Chat list does
 * (frontend/src/app/rooms/agents-list.ts; the rules are the server's, backend/agents.py: one's own sessions,
 * one manager, no circle, at most `maxDepth` levels - checked here first so a move that cannot be taken is
 * not offered).
 */

/** worker key ("wbc:<id>" / "wbo:<id>") -> manager key */
export type LinkMap = ReadonlyMap<string, string>;

export function linkMap(links: { worker: string; manager: string | null }[]): LinkMap {
  return new Map(links.filter((l) => !!l.manager).map((l) => [l.worker, l.manager as string]));
}

/** The managers above a key, nearest first (a loop in the data ends the walk). */
export function managersOf(map: LinkMap, key: string, maxDepth: number): string[] {
  const out: string[] = [];
  const seen = new Set([key]);
  let cur = map.get(key);
  while (cur && !seen.has(cur) && out.length <= maxDepth) {
    out.push(cur);
    seen.add(cur);
    cur = map.get(cur);
  }
  return out;
}

/** How many levels hang under a key (0: none). */
export function heightOf(map: LinkMap, key: string, maxDepth: number, depth = 0): number {
  if (depth > maxDepth) return depth;
  let h = 0;
  for (const [w, m] of map) if (m === key) h = Math.max(h, 1 + heightOf(map, w, maxDepth, depth + 1));
  return h;
}

export type WhyNot = 'self' | 'circle' | 'deep';

/** Why `worker` may not go under `manager`, or null. */
export function whyNot(map: LinkMap, worker: string, manager: string, maxDepth: number): WhyNot | null {
  if (worker === manager) return 'self';
  const above = managersOf(map, manager, maxDepth);
  if (above.includes(worker)) return 'circle';
  if (above.length + 2 + heightOf(map, worker, maxDepth) > maxDepth) return 'deep';
  return null;
}

export interface TreeItem<T> {
  row: T;
  depth: number;
  /** How many are directly under it. */
  kids: number;
  /** The top of its tree. */
  top: T;
}

/**
 * The rows as a tree, flattened in drawing order: the tops as `order` sorts them, each followed by the ones under
 * it (newest first). A row whose manager is not among the rows stands at the top.
 */
export function treeOf<T>(rows: T[], key: (r: T) => string, last: (r: T) => number, map: LinkMap,
                          order: (a: T, b: T) => number, maxDepth: number): TreeItem<T>[] {
  const byKey = new Map(rows.map((r) => [key(r), r]));
  const kids = new Map<string, T[]>();
  const tops: T[] = [];
  for (const r of rows) {
    const m = map.get(key(r));
    if (m && m !== key(r) && byKey.has(m)) kids.set(m, [...(kids.get(m) ?? []), r]);
    else tops.push(r);
  }
  tops.sort(order);
  const out: TreeItem<T>[] = [];
  const seen = new Set<string>();
  const walk = (r: T, depth: number, top: T) => {
    if (seen.has(key(r)) || depth > maxDepth) return;
    seen.add(key(r));
    const under = [...(kids.get(key(r)) ?? [])].sort((a, b) => last(b) - last(a));
    out.push({ row: r, depth, kids: under.length, top });
    for (const k of under) walk(k, depth + 1, top);
  };
  for (const r of tops) walk(r, 0, r);
  return out;
}
