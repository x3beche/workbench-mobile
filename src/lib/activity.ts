/**
 * The web top bar's Activity (frontend/src/app/topbar-activity.ts, topbar.ts):
 * its ranges, its sources and their colours, how its figures are written,
 * its words in English and Turkish, and what the strip shows - kept per
 * account on the device (the range and the figures switched on).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { compact } from './numbers';

export type ActSource = 'chat' | 'orchestrator' | 'agents' | 'other' | 'claude' | 'opencode';
/** In the web's order; each the chart palette's colour at its place (the web's --series-1 to -6). */
export const SOURCES: { id: ActSource; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'orchestrator', label: 'Orchestrator' },
  { id: 'agents', label: 'Agents' },
  { id: 'other', label: 'Other jobs' },
  { id: 'claude', label: 'Claude' },
  { id: 'opencode', label: 'OpenCode' },
];

export type ActMetric = 'tps' | 'spark' | 'tokens' | 'claude' | 'jobs' | 'cpu' | 'ram';
export const METRICS: { id: ActMetric; label: string }[] = [
  { id: 'tps', label: 'Tokens a second' },
  { id: 'spark', label: 'Chart' },
  { id: 'tokens', label: 'Tokens in the range' },
  { id: 'claude', label: 'Claude prompts' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'cpu', label: 'CPU' },
  { id: 'ram', label: 'Memory' },
];
const ALL: ActMetric[] = METRICS.map((m) => m.id);

export const RANGES: { id: string; long: string }[] = [
  { id: '30m', long: 'The last 30 minutes' },
  { id: '1h', long: 'The last hour' },
  { id: '3h', long: 'The last 3 hours' },
  { id: '6h', long: 'The last 6 hours' },
  { id: '12h', long: 'The last 12 hours' },
  { id: '24h', long: 'The last 24 hours' },
  { id: '3d', long: 'The last 3 days' },
  { id: '7d', long: 'The last 7 days' },
  { id: '30d', long: 'The last 30 days' },
];

/** A range's seconds, or null when it is not one: a number and m, h or d, 1 minute to 30 days (as the web's actSpan). */
export function actSpan(r: unknown): number | null {
  const m = /^([1-9][0-9]{0,4})([mhd])$/.exec(
    String(r ?? '')
      .trim()
      .toLowerCase(),
  );
  if (!m) return null;
  const s = +m[1] * (m[2] === 'm' ? 60 : m[2] === 'h' ? 3600 : 86400);
  return s >= 60 && s <= 30 * 86400 ? s : null;
}

/** How often the range is asked again: as the web's, 5 s to 2 min by its length. */
const EVERY_MS: Record<string, number> = {
  '30m': 15_000, '1h': 20_000, '3h': 20_000, '6h': 30_000, '12h': 45_000, '24h': 60_000, '3d': 90_000, '7d': 120_000, '30d': 120_000,
};
export function everyMs(r: string): number {
  return EVERY_MS[r] ?? Math.max(5_000, Math.min(120_000, ((actSpan(r) ?? 86400) * 1000) / 60));
}

// ---- how figures are written (the web's tokFmt, tpsFmt, memFmt, cpuFmt) ----
export const tok = (v: number) => compact(Math.round(v));
export const tps = (v: number) => (v >= 100 ? String(Math.round(v)) : v.toFixed(1));
export const mem = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
export const cpu = (p: number) => `${Math.round(p)}%`;

/** A round top for the y axis: 1, 2 or 5 times a power of ten. */
export function nice(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// ---- the words: the web's Turkish (i18n.ts) where it has them --------------
const TR: Record<string, string> = {
  Activity: 'Etkinlik',
  'this account: everyone in it, its agents and its Orchestrator': 'bu hesap: içindeki herkes, ajanları ve Orkestratörü',
  Range: 'Aralık',
  'e.g. 15m': 'örn. 15m',
  'Your own range': 'Kendi aralığınız',
  'Your own range: a number and m, h or d - 1m, 15m, 2h, 3d (up to 30d).':
    'Kendi aralığınız: bir sayı ve m, h ya da d - 1m, 15m, 2h, 3d (en fazla 30d).',
  Tokens: 'Token',
  Now: 'Şimdi',
  Calls: 'Çağrılar',
  'in-app models': 'uygulama içi modeller',
  prompts: 'prompt',
  Jobs: 'İşler',
  '100% = one core': '%100 = bir çekirdek',
  Memory: 'Bellek',
  'Shown in the strip': 'Şeritte gösterilenler',
  'Tokens a second': 'Saniyedeki token',
  Chart: 'Grafik',
  'Tokens in the range': 'Aralıktaki token',
  'Claude prompts': 'Claude promptları',
  '{n} calls': '{n} çağrı',
  in: 'giriş',
  out: 'çıkış',
  cache: 'cache',
  'tokens out/s': 'çıkış token/sn',
  idle: 'boşta',
  '{n} running': '{n} çalışıyor',
  '{n} waiting': '{n} bekliyor',
  '{n} agents': '{n} ajan',
  '1 agent': '1 ajan',
  'not measured yet': 'henüz ölçülmedi',
  '1 container': '1 konteyner',
  '{n} containers': '{n} konteyner',
  Orchestrator: 'Orkestratör',
  Sandbox: 'Sandbox',
  'Pool jobs': 'Havuz işleri',
  Chat: 'Sohbet',
  Agents: 'Ajanlar',
  'Other jobs': 'Diğer işler',
  'No tokens in this range': 'Bu aralıkta token yok',
  'The activity did not load': 'Etkinlik yüklenemedi',
  'Loading…': 'Yükleniyor…',
  total: 'toplam',
  Close: 'Kapat',
  'Activity of this account - a tap opens it': 'Bu hesabın etkinliği - dokununca açılır',
  '30m': '30dk', '1h': '1sa', '3h': '3sa', '6h': '6sa', '12h': '12sa', '24h': '24sa', '3d': '3g', '7d': '7g', '30d': '30g',
  'The last 30 minutes': 'Son 30 dakika',
  'The last hour': 'Son bir saat',
  'The last 3 hours': 'Son 3 saat',
  'The last 6 hours': 'Son 6 saat',
  'The last 12 hours': 'Son 12 saat',
  'The last 24 hours': 'Son 24 saat',
  'The last 3 days': 'Son 3 gün',
  'The last 7 days': 'Son 7 gün',
  'The last 30 days': 'Son 30 gün',
};
export type Tr = (s: string, n?: number) => string;
/** The words in `lang`; "{n}" filled with `n`. */
export function words(lang: 'en' | 'tr'): Tr {
  return (s, n) => {
    const w = lang === 'tr' ? (TR[s] ?? s) : s;
    return n == null ? w : w.replace('{n}', String(n));
  };
}
/** A range as the buttons write it ("24h", Turkish "24sa"); one's own as typed. */
export const rangeWord = (r: string, t: Tr) => t(r);

// ---- what the strip shows, kept per account -------------------------------
export interface ActPrefs {
  range: string;
  show: ActMetric[];
}
export const DEFAULT_PREFS: ActPrefs = { range: '24h', show: ALL };
const KEY = 'workbench.activity';
const listeners = new Set<(scope: string, p: ActPrefs) => void>();
const cache: Record<string, ActPrefs> = {};

function clean(x: unknown): ActPrefs {
  const o = (x && typeof x === 'object' ? x : {}) as { range?: unknown; show?: unknown };
  const range = actSpan(o.range) !== null ? String(o.range).trim().toLowerCase() : DEFAULT_PREFS.range;
  const show = Array.isArray(o.show) ? ALL.filter((m) => (o.show as unknown[]).includes(m)) : ALL;
  return { range, show };
}

export async function readActPrefs(scope: string): Promise<ActPrefs> {
  if (cache[scope]) return cache[scope];
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return (cache[scope] = clean(all[scope]));
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function writeActPrefs(scope: string, p: ActPrefs): Promise<void> {
  cache[scope] = p;
  for (const f of listeners) f(scope, p);
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    all[scope] = p;
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable: kept until the app is closed.
  }
}

/** Another view of the same account changed them (the sheet from Analytics, the strip's own). */
export function onActPrefs(f: (scope: string, p: ActPrefs) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** The total over the range, a column at a time (every source). */
export function totals(series: Record<string, number[] | undefined>, n: number): number[] {
  return Array.from({ length: n }, (_, i) => SOURCES.reduce((a, s) => a + (series[s.id]?.[i] ?? 0), 0));
}
