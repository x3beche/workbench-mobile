/**
 * Keeping an upside-down thread on its newest line.
 *
 * Every thread in the app - a room, a conversation, an OpenCode or Claude Code
 * session, the Orchestrator's own - is drawn `inverted`: the newest line sits
 * at the bottom and offset 0 is where it is. `bottomReader` is who is reading
 * there, and `followBottom` is the list being brought back to it as the content
 * grows: a line arriving, or the agent writing its answer into the last one.
 *
 * Following is for a reader who is at the bottom. Read further up, the thread
 * stays exactly where it was and "New messages" offers the way down: a line
 * arriving must never pull the page out from under someone reading it.
 *
 * The trap this file exists for: `maintainVisibleContentPosition` (which keeps
 * a reader further up in their place as lines arrive) moves the list itself,
 * and a move is told to the screen as a scroll - exactly like a finger's. Read
 * as one, it says "the reader has scrolled away" while the person is sitting at
 * the bottom watching the answer, and following then never happens again. So
 * only the person's own finger says where they are (`begin` / `end`).
 */

/** Within this many pixels of the newest line, the reader is at the bottom. */
export const AT_BOTTOM = 60;

/**
 * Late enough to land after the frame that laid the grown content out, and
 * after the list's own keep-the-place adjustment (maintainVisibleContentPosition)
 * for it - either one would otherwise undo this a frame later.
 */
const AFTER_LAYOUT = 50;

/** The bit of a FlatList this needs, so a screen's own item type stays free. */
interface Scroller {
  scrollToOffset: (o: { offset: number; animated?: boolean }) => void;
}

export interface BottomReader {
  /** Is the person reading the newest line? */
  atBottom: () => boolean;
  /** `onScroll`, in content pixels from the newest line. */
  scroll: (y: number) => void;
  /** `onScrollBeginDrag` / `onMomentumScrollBegin`: from here the moving is theirs. */
  begin: () => void;
  /** `onScrollEndDrag` / `onMomentumScrollEnd`: where it stopped is where they are. */
  end: () => void;
  /** "New messages", or a line sent from here: at the bottom again, whatever the offset. */
  toBottom: () => void;
}

/**
 * Where the reader is, told by their finger alone. The list's own adjustments -
 * the content growing under `maintainVisibleContentPosition` - arrive as scroll
 * events too, and are not the reader: those move between `begin` and `end`, so
 * one that comes unasked changes nothing.
 */
export function bottomReader(): BottomReader {
  let at = true;
  let touching = false;
  let lastY = 0;
  return {
    atBottom: () => at,
    scroll(y: number) {
      lastY = y;
      if (touching) at = y < AT_BOTTOM;
    },
    begin() {
      touching = true;
    },
    end() {
      touching = false;
      at = lastY < AT_BOTTOM;
    },
    toBottom() {
      at = true;
      lastY = 0;
    },
  };
}

/** The late second chance is per list: an answer being written changes the
 *  content several times a second, and none of those timers should pile up. */
const pending = new WeakMap<Scroller, ReturnType<typeof setTimeout>>();
/**
 * The `onContentSizeChange` of an inverted thread: back to the bottom - offset
 * 0 - after the layout frame, for a reader who is there, and nothing at all for
 * one who is not. Not animated, so an answer being written does not jitter the
 * list. `stillAtBottom` is asked again after the frame, and once more later (a
 * list may keep its own place again after ours): the reader may have scrolled
 * away in the meantime, and then nothing moves.
 */
export function followBottom(list: Scroller | null, stillAtBottom: () => boolean): void {
  if (!list || !stillAtBottom()) return;
  const go = () => {
    if (stillAtBottom()) list.scrollToOffset({ offset: 0, animated: false });
  };
  setTimeout(go, AFTER_LAYOUT);
  const late = pending.get(list);
  if (late) clearTimeout(late);
  pending.set(list, setTimeout(go, AFTER_LAYOUT * 3));
}

/**
 * `maintainVisibleContentPosition` for an inverted thread. A reader further up
 * keeps their place as lines arrive (minIndexForVisible 1 skips the newest cell
 * itself, so a line coming in does not push the page about). And a reader at the
 * bottom - within `AT_BOTTOM` of the content's start, which the list's transform
 * makes the visual bottom (the native side counts in the content's own space and
 * does not know of the transform) - is kept there natively, as the content grows.
 * With that in place the follow below has nothing to fight: the list is already
 * where it should be, and the JS side only covers a platform that ignores it.
 */
export const KEEP_PLACE = { minIndexForVisible: 1, autoscrollToTopThreshold: AT_BOTTOM } as const;
