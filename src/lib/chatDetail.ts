/**
 * How much of an answer's work a conversation shows, as the web app's Chat
 * lets a person choose it (frontend/src/app/chat-detail.ts) and as Settings >
 * Chat offers it here: the stops of the scale, what each one means, and the
 * words of the one line a folded answer's work is written as.
 *
 *   compact   only the answers: the thinking and the tool calls behind one
 *             line under an answer, opened when the person wants it
 *   normal    thinking folded, each tool call a row of its own (the default)
 *   detailed  everything open: the thinking, and what every tool call read
 *             and returned
 *
 * The choice is kept per person on the server (GET /api/me/side, `chat.detail`
 * - backend/session_prefs.py, PUT /api/me/side/chat), so the phone and a
 * browser draw the same answers the same way.
 */
import type { ChatDetail } from '../api/types';
import type { UiLang } from '../update/strings';

/** The stops, low to high detail: the setting is an index into this. */
export const DETAIL_STOPS: ChatDetail[] = ['compact', 'normal', 'detailed'];

export function detailIndex(d: ChatDetail): number {
  return Math.max(0, DETAIL_STOPS.indexOf(d));
}

export function detailAt(i: number): ChatDetail {
  return DETAIL_STOPS[Math.min(Math.max(i, 0), DETAIL_STOPS.length - 1)];
}

/** A count of characters as the Chat writes it: 940, 4.2k, 1.1M. */
export function chars(n: number): string {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : String(n);
}

/** A spell of thinking as it is written: 8.9 s, 41 s. */
export function secsOf(ms: number): string {
  const s = ms / 1000;
  return `${s < 10 ? String(Math.round(s * 10) / 10) : String(Math.round(s))} s`;
}

/** The words of the line a folded answer's work is written as. */
export interface ActivityWords {
  one: string;
  many: (n: number) => string;
  thought: (secs: string) => string;
  thinking: (n: string) => string;
  nothing: string;
}

/** What a folded answer's line says: "4 tool calls · thought 8.9 s" - how
 *  long it thought when that is known, how much it wrote otherwise. */
export function activityWords(
  tools: number,
  thinking: number,
  ms: number | null | undefined,
  w: ActivityWords,
): string {
  const bits: string[] = [];
  if (tools) bits.push(tools === 1 ? w.one : w.many(tools));
  if (ms != null && ms >= 500) bits.push(w.thought(secsOf(ms)));
  else if (thinking) bits.push(w.thinking(chars(thinking)));
  return bits.length ? bits.join(' · ') : w.nothing;
}

/** What a conversation says about the setting and about an answer's work. */
export interface ChatDetailStrings {
  /** Settings > Chat: the card and the three stops. */
  title: string;
  about: string;
  levels: { id: ChatDetail; label: string; about: string }[];
  /** What the setting looks like, so the scale is not a guess. */
  sample: (line: string) => string;
  /** The line a folded answer's work is written as (activityWords). */
  act: ActivityWords;
  /** The thinking's row: while it is written, and once it is done. */
  thinking: { live: string; done: string };
  /** The row several tools fold into: "Ran 4 tools". */
  ran: (n: number, failed: number) => string;
}

const en: ChatDetailStrings = {
  title: 'Chat detail',
  about: "How much of an answer's work the Chat shows you.",
  levels: [
    {
      id: 'compact',
      label: 'Compact',
      about: 'Only the answers: what the model did is one line under an answer, opened when you want it.',
    },
    { id: 'normal', label: 'Normal', about: 'Each tool call a line of its own; thinking folded.' },
    {
      id: 'detailed',
      label: 'Detailed',
      about: 'Everything open: the thinking, and what every tool call read and returned.',
    },
  ],
  sample: (line) => `In compact an answer says what was done: ${line}`,
  act: {
    one: '1 tool call',
    many: (n) => `${n} tool calls`,
    thought: (s) => `thought ${s}`,
    thinking: (n) => `thinking ${n} chars`,
    nothing: 'what it did',
  },
  thinking: { live: 'Thinking…', done: 'Thought it through' },
  ran: (n, failed) => `Ran ${n} tools${failed ? `, ${failed} failed` : ''}`,
};

const tr: ChatDetailStrings = {
  title: 'Sohbet ayrıntısı',
  about: 'Sohbetin bir cevabın işinin ne kadarını gösterdiği.',
  levels: [
    {
      id: 'compact',
      label: 'Sıkı',
      about: 'Sadece cevaplar: modelin yaptıkları cevabın altında tek satır, isteyince açılır.',
    },
    { id: 'normal', label: 'Normal', about: 'Her araç çağrısı kendi satırında; düşünmesi katlı.' },
    {
      id: 'detailed',
      label: 'Ayrıntılı',
      about: 'Her şey açık: düşünmesi ve her araç çağrısının neyi okuyup ne döndürdüğü.',
    },
  ],
  sample: (line) => `Sıkı'da bir cevap yapılanı söyler: ${line}`,
  act: {
    one: '1 araç çağrısı',
    many: (n) => `${n} araç çağrısı`,
    thought: (s) => `düşündü ${s}`,
    thinking: (n) => `düşünme ${n} karakter`,
    nothing: 'yaptıkları',
  },
  thinking: { live: 'Düşünüyor…', done: 'Düşündü' },
  ran: (n, failed) => `${n} araç çalıştırdı${failed ? `, ${failed} başarısız` : ''}`,
};

export function chatDetailStrings(lang: UiLang): ChatDetailStrings {
  return lang === 'tr' ? tr : en;
}
