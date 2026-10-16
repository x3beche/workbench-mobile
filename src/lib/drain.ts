/**
 * What has arrived, let out at the pace of reading rather than the pace it
 * came in.
 *
 * The server writes an answer a piece at a time - whatever accumulated in
 * ~200 ms (backend/cc_chat.py TAIL) - so text printed the moment it lands
 * arrives in lumps. This holds a position behind the last piece and walks it
 * forward every frame, a share of what is left each time, so the line flows
 * instead of jumping. It catches up long before the next piece, and the
 * share shrinks as the gap does, which is what keeps it from ever trailing.
 */
import { useEffect, useRef, useState } from 'react';

/** Of what is left to reveal, the share that comes out in one frame. */
const CATCH_UP = 0.16;
/** At least this many characters a second, so a slow answer does not crawl. */
const FLOOR = 70;
/**
 * And at least this many in one frame. Markdown is parsed again for every
 * reveal, so this is what keeps a long answer from being parsed sixty times a
 * second: two characters a frame reads as a steady hand and parses half as often.
 */
const LEAST = 2;
/** More than this behind at once is not a stream - a reload, a screen reopened mid-answer. */
const WHOLE = 420;

/**
 * How many characters one frame reveals: a share of what is left, at least
 * LEAST, at least FLOOR characters a second, and never more than is left.
 * This is the whole of the pacing, kept out of the loop so it can be read
 * and tested on its own.
 */
export function reveal(left: number, dt: number): number {
  if (left <= 0) return 0;
  return Math.min(left, Math.max(LEAST, Math.round(Math.max(left * CATCH_UP, (FLOOR * dt) / 1000))));
}

/** What a newly arrived text calls for. */
export type Next = 'show' | 'drain' | 'hold';

/**
 * Given what is on screen and what has arrived: 'hold' when it is the same,
 * 'show' when it must go up as it is - motion reduced, a line that was
 * replaced rather than added to, or a jump too large to be a stream (a screen
 * opened mid-answer, a reload) - and 'drain' when it should come out over
 * frames. Kept out of the hook so the decisions can be read and tested.
 */
export function pace(current: string, target: string, on = true): Next {
  if (current === target) return 'hold';
  const gap = target.length - current.length;
  if (!on || !target.startsWith(current) || gap <= 0 || gap > WHOLE) return 'show';
  return 'drain';
}

/**
 * `target` (what has arrived) revealed smoothly. `on` false - a reduced
 * motion setting - shows it at once.
 */
export function useSmoothText(target: string, on = true): string {
  const [shown, setShown] = useState(target);
  // What is on screen. Written and read inside the effect alone, never while
  // drawing: a render must not move it.
  const mine = useRef(target);

  useEffect(() => {
    const what = pace(mine.current, target, on);
    if (what === 'hold') return;
    if (what === 'show') {
      mine.current = target;
      setShown(target);
      return;
    }
    // A frame loop that ends when it catches up. A new piece restarts it, so
    // it always walks towards the newest text.
    let frame = 0;
    let last = 0;
    const step = (now: number) => {
      const left = target.length - mine.current.length;
      if (left <= 0) {
        frame = 0;
        return;
      }
      const dt = last ? Math.min(now - last, 120) : 16;
      last = now;
      mine.current = target.slice(0, mine.current.length + reveal(left, dt));
      setShown(mine.current);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, on]);

  return shown;
}
