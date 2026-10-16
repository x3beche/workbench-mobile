/**
 * The words are let out a frame at a time, not in the pieces the server sent
 * them in.
 *
 * Both halves of that are plain arithmetic here and are run: the pace a frame
 * reveals (reveal) and what a newly arrived piece calls for (pace, which is
 * where the "do not drain this" cases live). The hook itself is the few lines
 * of wiring around them - a frame loop - and is covered by the two of these
 * together.
 */
import { pace, reveal } from '../drain';

describe('the pace a frame reveals', () => {
  it('reveals nothing when nothing is left', () => {
    expect(reveal(0, 16)).toBe(0);
    expect(reveal(-5, 16)).toBe(0);
  });

  it('reveals more the further behind it is', () => {
    expect(reveal(200, 16)).toBeGreaterThan(reveal(40, 16));
    expect(reveal(40, 16)).toBeGreaterThan(reveal(4, 16));
  });

  it('reveals more when the frame took longer', () => {
    expect(reveal(40, 100)).toBeGreaterThanOrEqual(reveal(40, 16));
  });

  it('never reveals more than is left', () => {
    expect(reveal(1, 16)).toBe(1);
    expect(reveal(3, 500)).toBe(3);
  });

  it('reveals at least a couple of characters while there is anything left', () => {
    expect(reveal(9, 1)).toBeGreaterThanOrEqual(2);
  });
});

/** A stream of `per` characters every `every` ms, drawn at 60 frames a second. */
function stream({ per, every, seconds }: { per: number; every: number; seconds: number }) {
  const dt = 1000 / 60;
  let arrived = 0;
  let shown = 0;
  let next = every;
  let worst = 0;
  let biggest = 0;
  for (let t = 0; t < seconds * 1000; t += dt) {
    if (t >= next) {
      arrived += per;
      next += every;
    }
    const left = arrived - shown;
    worst = Math.max(worst, left);
    const by = reveal(left, dt);
    biggest = Math.max(biggest, by);
    shown += by;
  }
  return { arrived, shown, worst, biggest };
}

describe('a stream run through the pace', () => {
  it('keeps up with pieces arriving every 200 ms', () => {
    // backend/cc_chat.py publishes whatever accumulated in ~0.2 s.
    const got = stream({ per: 40, every: 200, seconds: 10 });
    expect(got.arrived).toBeGreaterThan(1900); // ~50 pieces went through
    // Never more than a few words behind, and never left behind: a lag, not a loss.
    expect(got.worst).toBeLessThan(60);
    expect(got.arrived - got.shown).toBeLessThan(60);
  });

  it('does not drop a piece on a fast stream', () => {
    const got = stream({ per: 200, every: 200, seconds: 10 });
    expect(got.arrived).toBeGreaterThan(9500);
    expect(got.arrived - got.shown).toBeLessThan(30);
  });

  it('reveals a piece over frames instead of in one jump', () => {
    // The whole point: a 40 character piece is not shown as 40 characters in
    // one frame. It comes out in steps that are a fraction of the piece.
    const got = stream({ per: 40, every: 200, seconds: 4 });
    expect(got.biggest).toBeLessThan(20);
    expect(got.biggest).toBeGreaterThanOrEqual(2);
  });

  it('never lets the lag grow: a long answer still ends on the last word', () => {
    const got = stream({ per: 60, every: 200, seconds: 30 });
    expect(got.worst).toBeLessThan(80);
    expect(got.arrived - got.shown).toBeLessThan(80);
  });
});

describe('what a newly arrived piece calls for', () => {
  it('drains a piece that goes on the end', () => {
    expect(pace('', 'The first words.')).toBe('drain');
    expect(pace('The first ', 'The first words.')).toBe('drain');
  });

  it('holds when there is nothing new', () => {
    expect(pace('the same', 'the same')).toBe('hold');
  });

  it('shows it as it is when motion is reduced', () => {
    expect(pace('The first ', 'The first words.', false)).toBe('show');
  });

  it('shows a line that was replaced rather than added to', () => {
    // A second answer, an edited line: it is not the same text growing.
    expect(pace('The first answer.', 'A completely different answer.')).toBe('show');
  });

  it('shows a line that got shorter', () => {
    expect(pace('the whole line', 'the whole')).toBe('show');
  });

  it('shows a screen opened mid-answer rather than replaying it', () => {
    expect(pace('', 'x'.repeat(500))).toBe('show');
    // Up to the point it is a stream, and no further.
    expect(pace('', 'x'.repeat(120))).toBe('drain');
  });

  it('drains a stream that arrives faster than it is drawn', () => {
    // The gap at its widest here is a few hundred characters, never a reload.
    expect(pace('', 'x'.repeat(300))).toBe('drain');
  });
});
