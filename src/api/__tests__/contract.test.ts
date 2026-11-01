/**
 * The app's types against the answers the server really sent (src/api/__tests__/fixtures/contract/, and the
 * README there for how each was taken). A field the app reads that the server stopped sending, or now sends
 * as another thing, fails here - the drift these fixtures exist for.
 */
import { checkFixtures, formatTable } from '../../../scripts/contract-check';

describe('the app’s contract with the server', () => {
  const result = checkFixtures();

  it('has a fixture for every answer the app reads', () => {
    expect(result.fixtures).toBeGreaterThanOrEqual(13);
  });

  it('finds every field the app reads in the answer, in the type it says', () => {
    // The table is the report: which fixture, which field, what the type says and what the server sent.
    expect(result.errors.length ? `\n${formatTable(result)}\n` : '').toBe('');
  });

  it('names the fields the server sends that the app does not type, without failing', () => {
    // Not an error: the app never reads them. A rename shows up as a `missing` above, beside its `extra` here.
    if (result.extras.length) console.info(formatTable({ ...result, errors: [] }));
    expect(result.extras.every((m) => m.kind === 'extra')).toBe(true);
  });
});
