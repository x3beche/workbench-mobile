/** Short times for lists: "now", "5m", "3h", "yesterday", "Mon", "12 Oct", "12 Oct 2025". */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function shortTime(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const s = (now.getTime() - t.getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t.getTime() >= midnight) return `${Math.floor(s / 3600)}h`;
  if (t.getTime() >= midnight - 86400_000) return 'yesterday';
  if (t.getTime() >= midnight - 6 * 86400_000) return DAYS[t.getDay()];
  const day = `${t.getDate()} ${MONTHS[t.getMonth()]}`;
  return t.getFullYear() === now.getFullYear() ? day : `${day} ${t.getFullYear()}`;
}

/** "14:05" - when a line was written, in the device's time. */
export function clock(iso: string | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
