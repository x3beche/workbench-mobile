import { clock, shortTime } from '../time';

// A Wednesday afternoon, in the test machine's own time zone.
const NOW = new Date(2026, 9, 14, 15, 30, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

describe('shortTime', () => {
  it.each([
    [ago(10_000), 'now'],
    [ago(5 * 60_000), '5m'],
    [ago(59 * 60_000), '59m'],
    [ago(3 * 3600_000), '3h'],
    [at(2026, 9, 13, 20), 'yesterday'],
    [at(2026, 9, 12), 'Mon'],
    [at(2026, 9, 8), 'Thu'],
    [at(2026, 9, 1), '1 Oct'],
    [at(2025, 11, 31), '31 Dec 2025'],
  ])('%s -> %s', (iso, want) => {
    expect(shortTime(iso, NOW)).toBe(want);
  });

  it('is empty for nothing or nonsense', () => {
    expect(shortTime(undefined, NOW)).toBe('');
    expect(shortTime('not a date', NOW)).toBe('');
  });
});

describe('clock', () => {
  it('gives hours and minutes', () => {
    expect(clock(new Date(2026, 0, 2, 9, 5).toISOString())).toBe('09:05');
    expect(clock(undefined)).toBe('');
    expect(clock('nope')).toBe('');
  });
});
