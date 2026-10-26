/**
 * Keeping an upside-down thread on its newest line (lib/stickBottom.ts): the
 * list is drawn inverted, so offset 0 is the bottom, and the content growing -
 * a line arriving, or one being written - brings it back there for a reader who
 * is at the bottom, and never for one who has scrolled up to read.
 */
import { followBottom } from '../stickBottom';

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

  it('does nothing once the list has gone', () => {
    expect(() => {
      followBottom(null, () => true);
      jest.advanceTimersByTime(A_FRAME);
    }).not.toThrow();
  });
});
