/**
 * Keeping an upside-down thread on its newest line.
 *
 * Every thread in the app - a room, a conversation, an OpenCode or Claude Code
 * session, the Orchestrator's own - is drawn `inverted`: the newest line sits
 * at the bottom and offset 0 is where it is. Each screen records whether the
 * reader is down there as `atBottom`, and `AT_BOTTOM` is how close counts, so a
 * finger resting a few pixels short still counts as the bottom.
 *
 * Following is this: the content grew - a line arrived, or the agent is writing
 * its answer into the last one - so the newest line is brought back into view,
 * for a reader who was already at the bottom. Read further up, the thread stays
 * exactly where it was and "New messages" offers the way down: a line arriving
 * must never pull the page out from under someone reading it.
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

/**
 * The `onContentSizeChange` of an inverted thread: back to the bottom - offset
 * 0 - after the layout frame, for a reader who is there, and nothing at all for
 * one who is not. Not animated, so an answer being written does not jitter the
 * list. `stillAtBottom` is asked again after the frame: the reader may have
 * scrolled away in the meantime, and then nothing moves.
 */
export function followBottom(list: Scroller | null, stillAtBottom: () => boolean): void {
  if (!stillAtBottom()) return;
  setTimeout(() => {
    if (stillAtBottom()) list?.scrollToOffset({ offset: 0, animated: false });
  }, AFTER_LAYOUT);
}
