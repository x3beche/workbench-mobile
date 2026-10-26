/**
 * Keeping an upside-down thread on its newest line (lib/stickBottom.ts): the
 * list is drawn inverted, so offset 0 is the bottom, and the content growing -
 * a line arriving, or one being written - brings it back there for a reader who
 * is at the bottom, and never for one who has scrolled up to read.
 *
 * And who the reader is: their finger, not the list. `maintainVisibleContentPosition`
 * moves the list as content arrives, and that arrives as a scroll event too -
 * reading it as "they scrolled away" is what left a streaming answer out of view.
 */
import { AT_BOTTOM, bottomReader, followBottom, KEEP_PLACE } from '../stickBottom';

/** Past the frame the list lays the grown content out in. */
const A_FRAME = 100;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const scroller = () => {
  const scrollToOffset = jest.fn();
  return { list: { scrollToOffset } as { scrollToOffset: jest.Mock } | null, scrollToOffset };
};

describe('an inverted thread', () => {
  it('goes back to the bottom a frame after the content grew, for a reader who is there', () => {
    const { list, scrollToOffset } = scroller();
    followBottom(list, () => true);
    // Not in the same frame: the list lays the grown content out, then moves.
    expect(scrollToOffset).not.toHaveBeenCalled();
    jest.advanceTimersByTime(A_FRAME);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  });

  it('leaves the page where it is for a reader further up', () => {
    const { list, scrollToOffset } = scroller();
    followBottom(list, () => false);
    jest.advanceTimersByTime(A_FRAME);
    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it('gives up when the reader scrolled away before the frame landed', () => {
    const { list, scrollToOffset } = scroller();
    let atBottom = true;
    followBottom(list, () => atBottom);
    atBottom = false;
    jest.advanceTimersByTime(A_FRAME);
    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it('says the same thing later too, for a list that kept its own place again', () => {
    const { list, scrollToOffset } = scroller();
    followBottom(list, () => true);
    jest.advanceTimersByTime(A_FRAME * 3);
    expect(scrollToOffset.mock.calls.length).toBeGreaterThan(1);
  });

  it('does nothing once the list has gone', () => {
    expect(() => {
      followBottom(null, () => true);
      jest.advanceTimersByTime(A_FRAME);
    }).not.toThrow();
  });

  it('asks the list to keep a reader at the bottom there itself', () => {
    // The transform makes the content's start the visual bottom; the native side
    // counts in the content's own space, so "the top" is where the newest line is.
    expect(KEEP_PLACE.autoscrollToTopThreshold).toBe(AT_BOTTOM);
    expect(KEEP_PLACE.minIndexForVisible).toBe(1);
  });
});

describe('the reader', () => {
  it('is not moved by the list keeping its own place', () => {
    const r = bottomReader();
    expect(r.atBottom()).toBe(true);
    r.scroll(240); // the content grew and maintainVisibleContentPosition made room
    expect(r.atBottom()).toBe(true); // no finger moved: still at the bottom
  });

  it('follows the finger, and remembers where it let go', () => {
    const r = bottomReader();
    r.begin();
    r.scroll(400);
    r.end();
    expect(r.atBottom()).toBe(false);
    r.begin();
    r.scroll(20);
    r.end();
    expect(r.atBottom()).toBe(true);
  });

  it('stays away when the list drifts back under a reader who is up the page', () => {
    const r = bottomReader();
    r.begin();
    r.scroll(1_200);
    r.end();
    expect(r.atBottom()).toBe(false);
    r.scroll(0); // the list's own doing, not theirs
    expect(r.atBottom()).toBe(false);
  });

  it('is at the bottom again when the page or a sent line says so', () => {
    const r = bottomReader();
    r.begin();
    r.scroll(900);
    r.end();
    r.toBottom();
    expect(r.atBottom()).toBe(true);
  });
});
