/** Figures as Analytics writes them: short counts, money, lengths of time, a day under a column. */

/** 950, 12.3k, 4.1M. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return String(Math.round(n));
  if (a < 1e6) return `${(n / 1e3).toFixed(a < 1e4 ? 1 : 0)}k`;
  if (a < 1e9) return `${(n / 1e6).toFixed(a < 1e7 ? 1 : 0)}M`;
  return `${(n / 1e9).toFixed(1)}B`;
}

/** $0.42, $12.30, $1,234; under a cent shown as such. */
export function money(usd: number): string {
  if (usd > 0 && usd < 0.01) return '<$0.01';
  if (usd >= 1000) return `$${Math.round(usd).toLocaleString('en-US')}`;
  return `$${usd.toFixed(2)}`;
}

/** 42s, 3m 5s, 1h 12m. */
export function seconds(s: number): string {
  const x = Math.max(0, Math.round(s));
  if (x < 60) return `${x}s`;
  if (x < 3600) return `${Math.floor(x / 60)}m ${x % 60}s`;
  return `${Math.floor(x / 3600)}h ${Math.floor((x % 3600) / 60)}m`;
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
};

/** "2026-10-14" -> "14 Oct" ("14 Eki"); anything else as it is. */
export function dayLabel(day: string, lang: 'en' | 'tr'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return day;
  return `${Number(m[3])} ${MONTHS[lang][Number(m[2]) - 1]}`;
}
