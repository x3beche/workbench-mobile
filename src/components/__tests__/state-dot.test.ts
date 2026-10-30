/** The Orchestrator's state dot (src/components/StateDot.tsx): one breath for
 *  every dot in the app, the same length the web breathes at, and reduced
 *  motion left still.
 *
 *  The animation is one `Animated.Value` made once for the whole app and
 *  shared, so two dots on the screen are always at the same point of the same
 *  breath. A dot given a loop of its own started whenever its row was drawn -
 *  which is what the web's dots did too, and why two rows side by side were in
 *  opposite halves of it. That sharing is one line of the component (a module
 *  level value, one `Animated.loop`); what is checked here is the breath it
 *  shares, which both apps must agree on. */
import { LIVE_MS, StateDot } from '../StateDot';

describe('the state dot', () => {
  it("breathes at the web app's own length", () => {
    expect(LIVE_MS).toBe(1800);
  });

  it('is a component', () => {
    expect(typeof StateDot).toBe('function');
  });
});
