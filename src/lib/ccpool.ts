/**
 * Settings > Claude pool without drawing it (the web's ccpool-settings.ts):
 * the subscription's windows as meters (warn from 75 %, danger from 90 %, as
 * the Chat's usage bar), the week's plan as the ring's parts - each person's
 * part, keys no one holds, Outside the pool and what is unused - and the
 * words the tables use (percentages with two decimals, "≈" before a part,
 * how long ago, the sessions' summary).
 */
import type { PoolOverview, PoolSession, PoolWindow } from '../api/types';
import type { UiLang } from '../update/strings';
import type { CcpoolStrings } from './ccpoolStrings';
import { compact } from './numbers';

/** Percent with two decimals: "2.98%", in Turkish "%2.98" (the web's pctFixed). */
export function pct(v: number | null | undefined, lang: UiLang): string {
  if (v == null || !isFinite(v)) return '–';
  const n = (Math.round(v * 100) / 100).toFixed(2);
  return lang === 'tr' ? '%' + n : n + '%';
}

/** API value as the web writes it: "$12.34" (the web's usdFixed), "–" for none. */
export function usd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '–';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** An API value, "≈" before it when part of it is estimated; "–" for nothing. */
export function apiValue(u: { cost_usd: number; cost_estimated_usd?: number }): string {
  if (!u.cost_usd) return '–';
  return (u.cost_estimated_usd ? '≈' : '') + usd(u.cost_usd);
}

export function tokens(n: number | null | undefined): string {
  return n ? compact(n) : '–';
}

/** "2 h 14 min", "3 d 4 h" (the web's span). */
export function span(ms: number, t: CcpoolStrings): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const u = t.units;
  if (s < 60) return `${s} ${u.s}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} ${u.min}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${u.h}${m % 60 ? ` ${m % 60} ${u.min}` : ''}`;
  const d = Math.floor(h / 24);
  return `${d} ${u.d}${h % 24 ? ` ${h % 24} ${u.h}` : ''}`;
}

/** "14:05", or "Fri 3 Oct 14:05" past a day (the web's localTime). */
export function localTime(ms: number, lang: UiLang, withDay = true): string {
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
  return new Date(ms).toLocaleString(
    loc,
    withDay
      ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' },
  );
}

/** "Starts again from 0 in 2 h 14 min, at 14:05". */
export function resetText(at: number, t: CcpoolStrings, lang: UiLang, now = Date.now()): string {
  const ms = at * 1000;
  if (ms <= now) return t.startsNow;
  return t.startsAgain(span(ms - now, t), localTime(ms, lang, ms - now >= 86_400_000));
}

export interface Meter {
  id: string;
  label: string;
  pct: number;
  text: string;
  tone: 'warn' | 'danger' | null;
  reset: string;
}

/** The subscription's windows: the 5-hour and the 7-day one, then whatever else the plan reports. */
export function meters(
  plan: PoolOverview['plan'] | undefined,
  t: CcpoolStrings,
  lang: UiLang,
  now = Date.now(),
): Meter[] {
  const out: Meter[] = [];
  const add = (id: string, label: string, w: PoolWindow | null | undefined) => {
    if (!w || typeof w.pct !== 'number') return;
    const reset = [w.resets_at ? resetText(w.resets_at, t, lang, now) : '', w.stale ? t.lastKnown : '']
      .filter(Boolean)
      .join(' · ');
    out.push({
      id,
      label,
      pct: Math.min(100, Math.max(0, w.pct)),
      text: pct(w.pct, lang),
      tone: w.pct >= 90 ? 'danger' : w.pct >= 75 ? 'warn' : null,
      reset,
    });
  };
  add('five_hour', t.fiveHour, plan?.five_hour);
  add('seven_day', t.sevenDay, plan?.seven_day);
  // "7-day Fable": the plan's own model names stay, the words around them are ours.
  for (const w of plan?.extra ?? [])
    add(w.id, w.label.startsWith('7-day ') ? t.sevenDayOf(w.label.slice(6)) : w.label, w);
  return out;
}

export interface Slice {
  id: string;
  label: string;
  pct: number;
  /** A person's index in the palette; 'ink' / 'dim' for keys no one holds and Outside the pool; null for Unused. */
  color: number | 'ink' | 'dim' | null;
}

/** The week as a whole: each person's part of the 7-day window, keys no one holds, Outside the pool, Unused; null without a figure. */
export function planSlices(d: PoolOverview, t: CcpoolStrings): Slice[] | null {
  const used = d.plan.week_pct;
  if (used == null) return null;
  const rows: Slice[] = [];
  d.accounts.forEach((a, i) => {
    const v = a.week?.plan_pct ?? 0;
    if (v > 0) rows.push({ id: 'a:' + a.id, label: a.name || a.email, pct: v, color: i });
  });
  const un = d.plan.unassigned_plan?.seven_day ?? 0;
  if (un > 0) rows.push({ id: 'unassigned', label: t.notAssigned, pct: un, color: 'ink' });
  const out = d.plan.outside?.seven_day ?? 0;
  if (out > 0) rows.push({ id: 'outside', label: t.outside, pct: out, color: 'dim' });
  rows.push({ id: 'unused', label: t.unused, pct: Math.max(0, 100 - used), color: null });
  return rows;
}

/** "3 min ago" (seconds). */
export function ago(ts: number | null | undefined, t: CcpoolStrings, now = Date.now()): string {
  if (!ts) return t.never;
  const s = Math.max(0, now / 1000 - ts);
  if (s < 90) return t.justNow;
  if (s < 3600) return t.minAgo(Math.floor(s / 60));
  if (s < 86400) return t.hAgo(Math.floor(s / 3600));
  return t.dAgo(Math.floor(s / 86400));
}

/** Its title, else its first words, else its short id. */
export function sessionName(s: PoolSession): string {
  return s.title || s.label || s.session_id.slice(0, 8);
}

export function sessionTokens(s: PoolSession): number {
  return s.total_tokens ?? (s.in_tokens || 0) + (s.out_tokens || 0) + (s.cache_read || 0) + (s.cache_write || 0);
}

/** "4 sessions · 1 active now · $3.20 · $0.40 outside sessions": what My sessions spent, and what of the account's total did not. */
export function mySummary(d: PoolOverview, t: CcpoolStrings): string {
  const rows = d.my_sessions ?? [];
  const on = rows.filter((s) => s.status === 'active').length;
  const bits = [t.sessions(rows.length)];
  if (on) bits.push(t.activeNow(on));
  const shown = rows.reduce((a, s) => a + (s.cost_usd || 0), 0);
  bits.push(usd(shown));
  const hidden = d.my_hidden;
  if (hidden?.count) bits.push(`${t.removed(hidden.count)} ${usd(hidden.cost_usd)}`);
  const manual = d.me.manual?.cost_usd ?? 0;
  const other = (d.me.usage?.cost_usd ?? 0) - shown - (hidden?.cost_usd ?? 0) - manual;
  if (other >= 0.005) bits.push(t.outsideSessions(usd(other)));
  if (manual >= 0.005) bits.push(t.byHand(usd(manual)));
  return bits.join(' · ');
}

/** "this week: Mon 20 Oct 14:05 – Mon 27 Oct 14:05". */
export function weekRange(d: PoolOverview, t: CcpoolStrings, lang: UiLang): string {
  const p = d.plan;
  if (!p.week_from) return '';
  return t.thisWeekRange(
    `${localTime(p.week_from * 1000, lang)} – ${p.week_to ? localTime(p.week_to * 1000, lang) : t.now}`,
  );
}

/** Shown in Settings: the pool is set up on this server and this person may look at it. */
export function poolShown(d: PoolOverview | null | undefined): boolean {
  return !!d && !!d.gateway?.configured && Array.isArray(d.accounts);
}
