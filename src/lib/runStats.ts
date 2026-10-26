/**
 * How one answer came - the line under it at rest and the card a tap opens
 * from it. This is the web app's module (frontend/src/app/run-stats.ts) for
 * this app: the Chat's own answers and OpenCode's runs there read one file,
 * so the two say the same things, in the same order, in the same words; here
 * the rows are the words of the screen's own language (WboStrings.run).
 *
 * What a caller does not know it leaves out: a row with nothing to say is not
 * drawn at all (an OpenCode run through someone else's provider has no cost to
 * tell; the window a model has is known only for the app's own gateway).
 */

export interface RunStats {
  /** Asked for, its first token - thinking or text - and its end, ms. */
  sent: number | null;
  first: number | null;
  done: number | null;
  /** The output tokens (thinking included), the prompt's own count, and what
   *  of the prompt came from the provider's cache or was written to it. */
  out: number | null;
  input: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  /** The thinking, when it was kept here: its length and how long it took. */
  thinkingChars?: number | null;
  thinkingMs?: number | null;
  /** The model's window, when it is known: Context used is against it. */
  context?: number | null;
  /** What the window held, when it is not the tokens in plus out (a run of
   *  several model calls: the last call's prompt is where it stood). */
  contextTokens?: number | null;
  model?: string | null;
  /** Already a name a person reads, not the provider's id. */
  provider?: string | null;
  /** The tokens are the characters' estimate, not the provider's count. */
  estimated?: boolean;
  /** The provider's own speed, when it gave one; worked out from the tokens
   *  and the time otherwise (see speed()). */
  tps?: number | null;
  /** The provider's own measure of the whole time and of the first token. */
  totalMs?: number | null;
  ttftMs?: number | null;
  /** Dollars, when the provider said. */
  cost?: number | null;
  stopped?: boolean;
  interrupted?: boolean;
  error?: string | null;
}

/** The words of the line and the card (lib/wboStrings.ts, the web's i18n.ts). */
export interface RunWords {
  details: string;
  sent: string;
  firstToken: string;
  finished: string;
  firstTokenIn: string;
  speed: string;
  thinking: string;
  writing: string;
  total: string;
  tokensIn: string;
  fromCache: string;
  writtenToCache: string;
  tokensOut: string;
  thinkingTokens: string;
  totalTokens: string;
  contextUsed: string;
  cost: string;
  model: string;
  status: string;
  stopped: string;
  interrupted: string;
  failed: string;
  done: string;
  restarted: string;
}

/** "5.4 s" - a duration. */
export function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function num(n: number | null | undefined): string {
  return n == null ? '\u2013' : n.toLocaleString('en-US');
}

/** "30.5k", "1.2M" - a count read at a glance. */
export function kfmt(n: number): string {
  return n < 1000
    ? String(n)
    : n < 1_000_000
      ? `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
      : `${(n / 1_000_000).toFixed(1)}M`;
}

/** The window's size: "1M", "128k". */
export function ctxFmt(n: number): string {
  return n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : `${Math.round(n / 1000)}k`;
}

/** Tokens a second as the card says it: the provider's own tenth kept. */
export function rate(tps: number): string {
  return Number.isInteger(tps) ? String(tps) : tps.toFixed(1);
}

/** Tokens a second as the line under the answer says it: a reader wants
 *  "130", not "129.7". */
export function rateShort(tps: number): string {
  return tps >= 10 ? String(Math.round(tps)) : tps.toFixed(1);
}

/** The speed of a run: what the provider said, else the output over the time
 *  it was written (its first token to its end). A run from before its first
 *  token was kept is measured over all of it - it is still an average, over a
 *  wider span. Under a tenth of a second says nothing of speed. */
export function speed(r: RunStats): number | null {
  if (r.tps != null) return r.tps;
  const from = r.first ?? r.sent;
  const done = r.done;
  if (!from || !done || !r.out) return null;
  const writing = (done - from) / 1000;
  return writing >= 0.1 ? Math.round((r.out / writing) * 10) / 10 : null;
}

/** The total time of a run. */
export function totalMs(r: RunStats): number | null {
  if (r.totalMs != null) return r.totalMs;
  return r.sent && r.done ? Math.max(0, r.done - r.sent) : null;
}

/** The time to its first token. */
export function ttftMs(r: RunStats): number | null {
  if (r.ttftMs != null) return r.ttftMs;
  return r.sent && r.first ? Math.max(0, r.first - r.sent) : null;
}

/** The line under a finished answer: "130 tok/s · 206 tok · 5.4 s". */
export function statsLine(r: RunStats, w: RunWords): string {
  const rate0 = speed(r);
  const est = r.estimated ? '~' : '';
  const ms = totalMs(r);
  const bits: string[] = [];
  if (rate0 != null) bits.push(`${est}${rateShort(rate0)} tok/s`);
  if (r.out) bits.push(`${est}${num(r.out)} tok`);
  if (ms != null) bits.push(secs(ms));
  if (r.stopped) bits.push(w.stopped);
  if (r.interrupted) bits.push(w.interrupted);
  return bits.join(' \u00b7 ') || w.details;
}

/** The card's rows, in the order above. */
export function statRows(r: RunStats, w: RunWords, money: (usd: number) => string): { k: string; v: string }[] {
  const rows: { k: string; v: string }[] = [];
  const add = (k: string, v: string | null | undefined | false) => {
    if (v) rows.push({ k, v });
  };
  const est = r.estimated ? '~' : '';
  add(w.sent, r.sent ? stamp(r.sent) : '');
  add(w.firstToken, r.first ? stamp(r.first) : '');
  add(w.finished, r.done ? stamp(r.done) : '');
  const ttft = ttftMs(r);
  add(w.firstTokenIn, ttft != null ? secs(ttft) : '');
  const rate0 = speed(r);
  add(w.speed, rate0 != null ? `${est}${rate(rate0)} tok/s` : '');
  add(w.thinking, r.thinkingMs ? secs(r.thinkingMs) : '');
  add(w.writing, r.first && r.done ? secs(Math.max(0, r.done - r.first)) : '');
  const ms = totalMs(r);
  add(w.total, ms != null ? secs(ms) : '');
  add(w.tokensIn, r.input ? num(r.input) : '');
  // Of those, what the provider read back from its prompt cache, and wrote to it.
  add(w.fromCache, r.cacheRead && r.input ? `${num(r.cacheRead)} \u00b7 ${Math.round((r.cacheRead / r.input) * 100)}%` : '');
  add(w.writtenToCache, r.cacheWrite ? num(r.cacheWrite) : '');
  add(w.tokensOut, r.out ? `${est}${num(r.out)}` : '');
  add(w.thinkingTokens, r.thinkingChars ? `~${num(Math.ceil(r.thinkingChars / 4))}` : '');
  if (r.input || r.out) add(w.totalTokens, num((r.input ?? 0) + (r.out ?? 0)));
  if (r.context && r.input) {
    const used = r.contextTokens ?? r.input + (r.out ?? 0);
    add(w.contextUsed, `${((used / r.context) * 100).toFixed(1)}% \u00b7 ${kfmt(used)} / ${ctxFmt(r.context)}`);
  }
  add(w.cost, r.cost != null ? money(r.cost) : '');
  add(w.model, r.model ? `${r.model}${r.provider ? ' \u00b7 ' + r.provider : ''}` : '');
  const status = r.interrupted
    ? `${w.interrupted} - ${w.restarted}`
    : r.stopped
      ? w.stopped
      : r.error
        ? w.failed
        : w.done;
  add(w.status, status + (r.error && !r.interrupted ? ` - ${r.error}` : ''));
  return rows;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Oct 2026, 18:24:31" - the reader's own time, in the device's zone. */
export function stamp(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ` +
    `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
  );
}
