/**
 * The conversations in the drawer, by when they were last written in:
 * Pinned, Today, Yesterday, Previous 7 days, Older - newest first in each,
 * empty groups left out. Days are the device's own calendar days.
 */
import type { Chat } from '../api/types';
import { previewText } from './markdown';
import { ago, clock } from './time';

export type GroupName = 'Pinned' | 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';

export interface ChatGroup {
  name: GroupName;
  chats: Chat[];
}

const DAY = 86_400_000;

function stamp(c: Chat): number {
  const t = new Date(c.updated_at || c.created_at || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function groupOf(c: Chat, now: Date = new Date()): GroupName {
  if (c.pinned) return 'Pinned';
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = stamp(c);
  if (t >= midnight) return 'Today';
  if (t >= midnight - DAY) return 'Yesterday';
  if (t >= midnight - 7 * DAY) return 'Previous 7 days';
  return 'Older';
}

const ORDER: GroupName[] = ['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Older'];

export function groupChats(chats: Chat[], now: Date = new Date()): ChatGroup[] {
  const by = new Map<GroupName, Chat[]>();
  for (const c of chats) {
    const g = groupOf(c, now);
    by.set(g, [...(by.get(g) ?? []), c]);
  }
  return ORDER.filter((g) => by.has(g)).map((name) => ({
    name,
    chats: [...(by.get(name) ?? [])].sort((a, b) => stamp(b) - stamp(a)),
  }));
}

/** When a conversation was last written in, as its group needs it: "12 min ago"
 *  today, "14:05" yesterday, "Tue" this week, "6 Oct" before. */
export function rowTime(c: Chat, group: GroupName, now: Date = new Date()): string {
  const t = new Date(c.updated_at || c.created_at || 0);
  if (Number.isNaN(t.getTime())) return '';
  if (group === 'Yesterday') return clock(t.toISOString());
  return ago(t.toISOString(), now);
}

/** The one line under a conversation's title: who wrote last and what, or that
 *  nothing was written yet (the web's row, rooms/commandcode.ts). The words are
 *  the line's own, without its Markdown, and the row cuts them to one line. */
export function chatSnippet(c: Chat): string {
  const last = c.last;
  if (!last) return 'No messages yet';
  const said = previewText(last.text ?? '');
  // A line that opens with the conversation's own title - a heading the writer
  // began the first message with - would say it twice in one row.
  const title = c.title.trim();
  const under =
    title && said.toLowerCase().startsWith(title.toLowerCase())
      ? said.slice(title.length).replace(/^[\s:.,;\u2013\u2014-]+/, '')
      : '';
  const text = under || said;
  return last.by ? `${last.by}: ${text}` : text;
}

/** The conversations whose title or last line has every word of `q` (the server searches the rest). */
export function filterChats(chats: Chat[], q: string): Chat[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return chats;
  return chats.filter((c) => {
    const hay = `${c.title} ${c.last?.text ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** "Good morning" before noon, "Good afternoon" until six, then "Good evening". */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Up to two initials for an avatar: "Ada Demir" -> "AD", "ada@example.com" -> "A". */
export function initials(name: string | null | undefined): string {
  const words = (name || '')
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0]).toUpperCase();
}
