/** The Orchestrator's state dot (src/components/StateDot.tsx): one breath for
 *  every dot in the app, the same length the web breathes at, and reduced
 *  motion left still.
 *
 *  The animation is one `Animated.Value` made once for the whole app and
 *  shared, so two dots on the screen are always at the same point of the same
 *  breath. A dot given a loop of its own started whenever its row was drawn -
 *  which is what the web's dots did too, and why two rows side by side were in
 *  opposite halves of it. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_MS } from '../StateDot';

const SOURCE = readFileSync(join(__dirname, '..', 'StateDot.tsx'), 'utf8');

describe('the state dot', () => {
  it("breathes at the web app's own length", () => {
    expect(LIVE_MS).toBe(1800);
  });

  it('shares one breath, and one only', () => {
    // One value for the whole module: not a loop per dot.
    expect((SOURCE.match(/const breath = new Animated\.Value\(1\)/g) ?? []).length).toBe(1);
    expect((SOURCE.match(/Animated\.loop\(/g) ?? []).length).toBe(1);
    expect(SOURCE).toContain('LIVE_MS / 2');            // half there, half back
    expect(SOURCE).toContain('outputRange: [0.2, 1]');   // the web's 1 -> .2
    expect(SOURCE).toContain('outputRange: [0.8, 1]');   // and its small scale
    expect(SOURCE).toContain('useReduceMotion');         // still, with reduced motion
  });
});
