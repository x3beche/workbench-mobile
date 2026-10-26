/** The line under an answer and the card it opens (the web's run-stats.ts, for this app). */
import { ctxFmt, kfmt, secs, speed, statRows, statsLine, totalMs, ttftMs } from '../runStats';
import type { RunStats } from '../runStats';
import { wboStrings } from '../wboStrings';

const en = wboStrings('en').run;
const tr = wboStrings('tr').run;
const money = (usd: number) => `$${usd.toFixed(2)}`;

const run = (over: Partial<RunStats> = {}): RunStats => ({
  sent: 1_000,
  first: 3_000,
  done: 9_000,
  out: 300,
  input: null,
  cacheRead: null,
  cacheWrite: null,
  ...over,
});

describe('how an answer came', () => {
  it('reads the speed from what it wrote over the time it wrote it', () => {
    expect(speed(run())).toBe(50); // 300 tokens in the 6 s after its first
    expect(speed(run({ first: null }))).toBe(37.5); // kept before its first token: over all of it
    expect(speed(run({ out: null }))).toBeNull();
    expect(speed(run({ tps: 41.2 }))).toBe(41.2); // the provider's own, when it said
    expect(totalMs(run())).toBe(8_000);
    expect(ttftMs(run())).toBe(2_000);
    expect(ttftMs(run({ first: null }))).toBeNull();
  });

  it('writes the line under it: the speed, what it wrote and how long', () => {
    expect(statsLine(run(), en)).toBe('50 tok/s · 300 tok · 8.0 s');
    expect(statsLine(run(), tr)).toBe('50 tok/s · 300 tok · 8.0 s');
    expect(statsLine(run({ out: null }), en)).toBe('8.0 s');
    // Nothing it knows: the words alone, so the line still opens the card.
    expect(statsLine(run({ sent: null, first: null, done: null, out: null }), en)).toBe('Details');
    expect(statsLine(run({ stopped: true }), en)).toBe('50 tok/s · 300 tok · 8.0 s · stopped');
    expect(statsLine(run({ interrupted: true }), tr)).toBe('50 tok/s · 300 tok · 8.0 s · yarıda kaldı');
    expect(statsLine(run({ estimated: true }), en)).toBe('~50 tok/s · ~300 tok · 8.0 s');
  });

  it('draws the card rows in the web order, and leaves out what it does not know', () => {
    const rows = statRows(run(), en, money);
    expect(rows.map((r) => r.k)).toEqual([
      'Sent',
      'First token',
      'Finished',
      'Time to first token',
      'Average speed',
      'Writing',
      'Total time',
      'Tokens out',
      'Total tokens',
      'Status',
    ]);
    // No cost, no thinking, no cache and no window: nothing to say, no row at all.
    expect(rows.find((r) => r.k === 'Cost')).toBeUndefined();
    expect(rows.find((r) => r.k === 'Context used')).toBeUndefined();
    expect(rows.find((r) => r.k === 'Average speed')?.v).toBe('50 tok/s');
    expect(rows.find((r) => r.k === 'Total time')?.v).toBe('8.0 s');
    expect(rows.find((r) => r.k === 'Status')?.v).toBe('finished');
  });

  it('adds the prompt, its cache and the window when it has them', () => {
    const rows = statRows(
      run({ input: 2_000, cacheRead: 800, cacheWrite: 100, context: 1_000_000, contextTokens: 59_000 }),
      en,
      money,
    );
    const of = (k: string) => rows.find((r) => r.k === k)?.v;
    expect(of('Tokens in')).toBe('2,000');
    expect(of('From cache')).toBe('800 · 40%');
    expect(of('Written to cache')).toBe('100');
    expect(of('Context used')).toBe('5.9% · 59k / 1M');
  });

  it('names the model with its provider, and what became of the run', () => {
    const rows = statRows(run({ model: 'deepseek/deepseek-v4', provider: 'Command Code', error: 'boom' }), en, money);
    const of = (k: string) => rows.find((r) => r.k === k)?.v;
    expect(of('Model')).toBe('deepseek/deepseek-v4 · Command Code');
    expect(of('Status')).toBe('failed - boom');
    const stopped = statRows(run({ stopped: true }), en, money);
    expect(stopped.find((r) => r.k === 'Status')?.v).toBe('stopped');
  });

  it('writes counts and windows the way the card reads them', () => {
    expect(kfmt(950)).toBe('950');
    expect(kfmt(1_500)).toBe('1.5k');
    expect(kfmt(12_000)).toBe('12k');
    expect(kfmt(1_200_000)).toBe('1.2M');
    expect(ctxFmt(200_000)).toBe('200k');
    expect(ctxFmt(1_000_000)).toBe('1M');
    expect(secs(5_400)).toBe('5.4 s');
  });
});
