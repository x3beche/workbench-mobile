/**
 * Short times for lists: "now", "5m", "3h", "yesterday", "Mon", "12 Oct",
 * "12 Oct 2025" - and "şimdi", "5dk", "dün", "12 Eki" in Turkish, because a
 * date is read in the reader's own words, not translated afterwards.
 */
import type { UiLang } from '../update/strings';

const MONTHS: Record<UiLang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
};
const DAYS: Record<UiLang, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
};
const SHORT = {
  en: { now: 'now', yesterday: 'yesterday', m: 'm', h: 'h' },
  tr: { now: 'şimdi', yesterday: 'dün', m: 'dk', h: 'sa' },
};

export function shortTime(iso: string | undefined, now: Date = new Date(), lang: UiLang = 'en'): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const w = SHORT[lang] ?? SHORT.en;
  const s = (now.getTime() - t.getTime()) / 1000;
  if (s < 60) return w.now;
  if (s < 3600) return `${Math.floor(s / 60)}${w.m}`;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t.getTime() >= midnight) return `${Math.floor(s / 3600)}${w.h}`;
  if (t.getTime() >= midnight - 86400_000) return w.yesterday;
  if (t.getTime() >= midnight - 6 * 86400_000) return (DAYS[lang] ?? DAYS.en)[t.getDay()];
  const day = `${t.getDate()} ${(MONTHS[lang] ?? MONTHS.en)[t.getMonth()]}`;
  return t.getFullYear() === now.getFullYear() ? day : `${day} ${t.getFullYear()}`;
}

/** "14:05" - when a line was written, in the device's time. */
export function clock(iso: string | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** How long ago, as the lists say it: "just now", "34 min ago", "1 h ago", and
 *  a date for anything older (the web's `when`, rooms/commandcode.ts). Words
 *  read at a glance where "34m" has to be worked out. */
export function ago(iso: string | undefined, now: Date = new Date(), lang: UiLang = 'en'): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const s = Math.max(0, (now.getTime() - t.getTime()) / 1000);
  if (lang === 'tr') {
    if (s < 60) return 'az önce';
    if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
    if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
    return shortTime(iso, now, lang);
  }
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return shortTime(iso, now, lang);
}
