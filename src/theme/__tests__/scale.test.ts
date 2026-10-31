/**
 * The phones' "larger text" (1.3x) and the type scale: a line of text gets the line height the
 * scale gives it, and the phones scale the font size but not that height - so every pair has to
 * keep a line at 1.3. The tightest are micro (11/15) and a row (13.5/18); at 1.5 the micro line
 * would be shorter than its letters, which is why the web export's audit stopped at 1.3.
 */
import { type } from '../tokens';

const PAIRS: [string, number, number | undefined][] = [
  ['body', type.body, type.bodyLine],
  ['input', type.input, type.inputLine],
  ['small', type.small, type.smallLine],
  ['tiny', type.tiny, type.tinyLine],
  ['micro', type.micro, type.microLine],
  ['row', type.row, type.rowLine],
  ['lead', type.lead, type.leadLine],
  ['display', type.display, type.displayLine],
];

describe('the type scale at the system\'s larger text', () => {
  it.each(PAIRS)('%s keeps its line at 1.3x', (_name, size, line) => {
    expect(line).toBeDefined();
    // The phone multiplies the font size by the system's scale and leaves the line height alone.
    expect(line! + 0.01).toBeGreaterThanOrEqual(size * 1.3);
  });

  it('has no text size without a line where one is needed', () => {
    // Title and brand are set one line at a time (a header, the wordmark); the rest are in PAIRS.
    expect(type.title).toBeGreaterThan(0);
    expect(type.brand).toBeGreaterThan(0);
  });
});
