import {
  BLOCK_GAP, NEAR_TURNS, gapsOf, lastBlock, turnsToFull, windowFor, xAt,
} from '../sessionFlow';

/** The run's window, ported from the web (`rooms/session-flow.ts`): the same nine cases the column was built
 *  against, so the sheet and the column read a run the same way. */
const m = 60_000;
const h = 3_600_000;
const t0 = 1_000_000_000_000;
const now = t0 + 14 * h;
const spans = [
  { start: t0, end: t0 + 5 * m },
  { start: t0 + 12 * m, end: t0 + 16 * m },
];
const night = [...spans, { start: t0 + 13 * h, end: t0 + 13 * h + 2 * m }];

test('a 7 min quiet is one stretch of work', () => {
  const b = lastBlock(spans, t0 + 20 * m)!;
  expect(b.from).toBe(t0);
  expect(b.to).toBe(t0 + 16 * m);
});

test('a 13 h night ends the block', () => {
  expect(lastBlock(night, now)!.from).toBe(t0 + 13 * h);
});

test('auto while working: the last 15 minutes', () => {
  const w = windowFor('auto', night, now, true);
  expect([w.from, w.to, w.auto]).toEqual([now - 15 * m, now, 'working']);
});

test('auto when idle: the last stretch of work, with a little room', () => {
  const w = windowFor('auto', night, now, false);
  expect(w.auto).toBe('block');
  // the block is two minutes long, so the five-minute floor widens it - the point is that the work is
  // inside the window, and that the window is never one call wide
  expect(w.from).toBeLessThanOrEqual(t0 + 13 * h);
  expect(w.to).toBeGreaterThanOrEqual(t0 + 13 * h + 2 * m);
  expect(w.to - w.from).toBeGreaterThanOrEqual(5 * m);
});

test('"all" folds the quiet stretches, so the work is not a sliver at the left', () => {
  const w = windowFor('all', night, now, false);
  expect(w.gaps).toHaveLength(2);
  const gap = w.gaps[0];
  expect(Math.abs((gap.to - gap.from) - (13 * h - 16 * m))).toBeLessThan(m);
  expect(xAt(w, t0, 300)).toBeLessThan(5);
  expect(xAt(w, t0 + 13 * h + 2 * m, 300)).toBeGreaterThan(295);
  const middle = xAt(w, w.gaps[0].from, 300);
  expect(middle).toBeGreaterThan(30);
  expect(middle).toBeLessThan(280);
});

test('unfolded, the same end would sit at 279 of 300', () => {
  expect(Math.round(xAt({ from: t0, to: now, gaps: [] }, t0 + 13 * h + 2 * m, 300))).toBe(279);
});

test('the estimate is drawn only under 30 turns, and never while idle', () => {
  const flat = Array.from({ length: 40 }, (_, i) => ({ turn: i + 1, at: t0 + i, used: 100_000 + i * 10, limit: 1_000_000 }));
  const far = turnsToFull(flat);
  expect(far === null || far > NEAR_TURNS).toBe(true);
  const near = Array.from({ length: 40 }, (_, i) => ({ turn: i + 1, at: t0 + i, used: 100_000 + i * 15_000, limit: 1_000_000 }));
  expect(turnsToFull(near)!).toBeLessThanOrEqual(NEAR_TURNS);
});

test('ten minutes is the boundary between two stretches of work', () => {
  expect(BLOCK_GAP).toBe(10 * m);
  expect(gapsOf([{ start: 0, end: m }], 0, 11 * m)).toHaveLength(0);
  expect(gapsOf([{ start: 0, end: m }], 0, 12 * m)).toHaveLength(1);
});
