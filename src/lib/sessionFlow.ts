/** The arithmetic under the run's graph (rooms/session-charts.ts): which stretch of time the column shows, how
 *  the quiet stretches are folded out of it, and where an instant lands across what is left.
 *
 *  Here rather than in the component because it is the part worth testing on its own: no Angular, no DOM, only
 *  the numbers the server sent and the tick the column counts with. */

/** One turn's window, as the server sends it. */
export interface CtxPoint { turn: number; at: number | null; used: number; limit: number; drop?: boolean }

/** A run that was quiet for longer than this stopped; the next slice is a new stretch of work. */
export const BLOCK_GAP = 10 * 60_000;
export type RangeId = 'auto' | '15m' | '1h' | 'all';

export interface Win {
  from: number;
  to: number;
  /** the quiet stretches "all" folds away, so thirteen idle hours do not eat the graph */
  gaps: { from: number; to: number }[];
  /** how the window was chosen when it was left to the range itself */
  auto?: 'working' | 'block' | 'recent';
}

/** The last stretch of work: the last slice, and back while each gap to the one before it is under ten minutes. */
export function lastBlock(spans: { start: number; end: number }[], now: number): { from: number; to: number } | null {
  const rows = spans.filter(s => s.start <= now).sort((a, b) => a.start - b.start);
  if (!rows.length) return null;
  let to = rows[rows.length - 1].end;
  let from = rows[rows.length - 1].start;
  for (let i = rows.length - 2; i >= 0; i--) {
    if (from - rows[i].end > BLOCK_GAP) break;
    from = Math.min(from, rows[i].start);
  }
  return { from: Math.min(from, to), to: Math.max(to, from) };
}

/** The idle stretches inside a window, longer than the block gap: what "all" folds and marks. */
export function gapsOf(spans: { start: number; end: number }[], from: number, to: number): { from: number; to: number }[] {
  const rows = spans.filter(s => s.end > from && s.start < to).sort((a, b) => a.start - b.start);
  const out: { from: number; to: number }[] = [];
  let at = from;
  for (const s of rows) {
    const start = Math.max(from, s.start);
    if (start - at > BLOCK_GAP) out.push({ from: at, to: start });
    at = Math.max(at, Math.min(to, s.end));
  }
  if (to - at > BLOCK_GAP) out.push({ from: at, to });
  return out;
}

/**
 * The window the chart shows. Left alone ("auto") it is the question a person is asking: while the run works,
 * the last quarter of an hour; once it has stopped, the stretch it worked, so the strip is the run and not the
 * thirteen hours it has been sitting still since.
 */
export function windowFor(range: RangeId, spans: { start: number; end: number }[], now: number,
                         working: boolean): Win {
  if (range === '15m') return { from: now - 15 * 60_000, to: now, gaps: [] };
  if (range === '1h') return { from: now - 60 * 60_000, to: now, gaps: [] };
  if (range === 'all') {
    const first = spans.length ? Math.min(...spans.map(s => s.start)) : now - 60_000;
    const from = Math.min(first, now - 60_000);
    return { from, to: now, gaps: gapsOf(spans, from, now), auto: 'recent' };
  }
  if (working) return { from: now - 15 * 60_000, to: now, gaps: [], auto: 'working' };
  const block = lastBlock(spans, now);
  if (!block) return { from: now - 15 * 60_000, to: now, gaps: [], auto: 'recent' };
  const pad = Math.max(30_000, Math.round((block.to - block.from) * 0.02));
  return { from: block.from - pad, to: block.to + pad, gaps: [], auto: 'block' };
}

/** The stretch a compressed gap takes on the axis, in viewBox units of a 300 wide chart. */
const BREAK = 12;

/** The window cut into the stretches it keeps: the gaps between them are the breaks. */
export function segments(w: Win): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let at = w.from;
  for (const g of w.gaps) {
    if (g.from > at) out.push({ from: at, to: g.from });
    at = Math.max(at, g.to);
  }
  if (at < w.to) out.push({ from: at, to: w.to });
  return out.length ? out : [{ from: w.from, to: Math.max(w.from + 1, w.to) }];
}

/** Where an instant sits across a window that folds its gaps: one reading for the strip and its bars. */
export function xAt(w: Win, at: number, width = 300): number {
  const segs = segments(w);
  const kept = segs.reduce((n, s) => n + (s.to - s.from), 0);
  const each = Math.max(1e-6, (width - BREAK * Math.max(0, segs.length - 1)) / Math.max(1, kept));
  let x = 0;
  for (let i = 0; i < segs.length; i++) {
    if (at <= segs[i].from) return x;
    if (at <= segs[i].to) return x + (at - segs[i].from) * each;
    x += (segs[i].to - segs[i].from) * each + (i < segs.length - 1 ? BREAK : 0);
  }
  return width;
}

/** Where each break sits, for the dashed line that says "time passed here". */
export function breakAt(w: Win, width = 300): { x: number; ms: number }[] {
  return w.gaps.map(g => ({ x: xAt(w, g.from, width) + BREAK / 2, ms: g.to - g.from }));
}


/** How many turns until the window is full, at the pace of its last few turns - a rough guess, and said as
 *  one: the turns are not the same size twice. Null when the line is flat or the window unknown. */
export function turnsToFull(points: CtxPoint[], keep = 5): number | null {
  const rows = points.filter(p => p.used > 0);
  const limit = rows[rows.length - 1]?.limit ?? 0;
  if (!limit || rows.length < 3) return null;
  const last = rows.slice(-keep);
  const steps: number[] = [];
  for (let i = 1; i < last.length; i++) steps.push(last[i].used - last[i - 1].used);
  const grew = steps.filter(s => s > 0);
  if (!grew.length) return null;
  const pace = grew.reduce((a, b) => a + b, 0) / grew.length;
  if (pace <= 0) return null;
  const left = limit - rows[rows.length - 1].used;
  const turns = Math.round(left / pace);
  return turns > 0 && turns < 10_000 ? turns : null;
}

/** The most turns ahead an estimate is still worth the room it takes: past it the number is a joke, not a
 *  warning ("compaction in ~1329 turns"). */
export const NEAR_TURNS = 30;

