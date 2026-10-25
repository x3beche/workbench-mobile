/**
 * The Claude sessions, without drawing them: one's own Claude Code runs from
 * the Claude pool (backend/wbclaude.py), as the web app's Chat shows them
 * (frontend/src/app/rooms/claude-sessions.ts) - what the bridge does in
 * words, which sessions the drawer lists, the turns read a page at a time,
 * the lines sent from here until the conversation shows them, and the
 * pictures a message may carry.
 */
import type { UploadPart, WbcBridge, WbcImageRules, WbcMessage, WbcSession, WbcTurn, WbcTurnsPage } from '../api/types';
import type { Dot } from './orchestrator';
import type { WbcStrings } from './wbcStrings';

/** Turns read at a time, as a room's lines. */
export const TURNS_PAGE = 10;
/** What wb-claude types before a remote message (the server says its own `mark`). */
export const MARK = '[remote message from Workbench]';
export const IMAGE_RULES: WbcImageRules = {
  max: 4,
  bytes: 5 * 1024 * 1024,
  types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
};

/** What the bridge is doing, in words; the session's status when none holds it. */
export function stateWord(s: Pick<WbcSession, 'status' | 'bridge'>, t: WbcStrings): string {
  const b = s.bridge;
  if (!b?.connected) return t.status[s.status] ?? s.status;
  return bridgeWord(b, t);
}

export function bridgeWord(b: WbcBridge | null, t: WbcStrings): string {
  if (!b || !b.connected) return t.notConnected;
  if (b.state === 'working') return t.working;
  if (b.state === 'waiting') return t.waitingComputer;
  if (b.state === 'starting') return t.starting;
  return t.atPrompt;
}

/** The live dot (StateDot): green at the prompt, pulsing while Claude works, amber while it waits; none unconnected. */
export function liveDot(b: WbcBridge | null | undefined): Dot | null {
  if (!b?.connected) return null;
  if (b.state === 'working') return 'running';
  if (b.state === 'waiting' || b.state === 'starting') return 'retry';
  if (b.state === 'ended') return 'stopped';
  return 'idle';
}

/** The drawer's: connected ones and the last day's (and the open one); a search narrows them by name and computer. */
export function shownSessions(
  rows: WbcSession[],
  q = '',
  open: string | null = null,
  now = Date.now() / 1000,
): WbcSession[] {
  const words = q.trim().toLowerCase();
  const day = now - 86400;
  return rows.filter(
    (s) =>
      (s.bridge?.connected || (s.last_ts ?? 0) > day || s.session_id === open) &&
      (!words ||
        s.name.toLowerCase().includes(words) ||
        (s.computer || '').toLowerCase().includes(words) ||
        'claude'.includes(words)),
  );
}

/** A time in seconds as the drawer's short times read an ISO one. */
export function isoOf(ts: number | null | undefined): string | undefined {
  return ts ? new Date(ts * 1000).toISOString() : undefined;
}

const key = (t: WbcTurn) => `${t.id}:${t.role}`;
export const turnKey = key;

/**
 * The newest page laid over what is held: the turns before where it starts
 * are kept, the page replaces the rest. `gap` when what is held ends before
 * the page starts and there is more above it (more was said than a page
 * holds): then only the page is kept, to be read up again a page at a time.
 */
export function layTurns(held: WbcTurn[] | null, page: WbcTurnsPage): { turns: WbcTurn[]; gap: boolean } {
  const got = page.turns ?? [];
  if (!held?.length || !got.length) return { turns: held?.length && !got.length ? held : got, gap: false };
  const first = got[0].at;
  const keep = held.filter((x) => x.at < first);
  const known = new Set(held.map(key));
  const touches = got.some((x) => known.has(key(x))) || held[held.length - 1].at >= first;
  if (!touches && page.more) return { turns: got, gap: true };
  return { turns: [...keep, ...got], gap: false };
}

/** An older page put before what is held; `added` 0 when it brought nothing new. */
export function putOlderTurns(held: WbcTurn[], older: WbcTurn[]): { turns: WbcTurn[]; added: number } {
  const known = new Set(held.map(key));
  const fresh = older.filter((x) => !known.has(key(x)));
  return { turns: fresh.length ? [...fresh, ...held] : held, added: fresh.length };
}

/** A remote prompt without the mark wb-claude typed before it. */
export function unmark(text: string, mark = MARK): string {
  return text.startsWith(mark) ? text.slice(mark.length).trimStart() : text;
}

/**
 * The lines sent from here still on their way, and the ones just delivered
 * that the conversation does not show yet (the gateway records the prompt a
 * moment later); the rest are in the turns. Ten minutes back.
 */
export function pendingOf(
  messages: WbcMessage[],
  turns: WbcTurn[],
  mark = MARK,
  now = Date.now() / 1000,
): WbcMessage[] {
  const flat = (x: string) => x.replace(/\s+/g, ' ').trim();
  const remote = turns.filter((x) => x.remote);
  const shown = remote.map((x) => flat(unmark(x.text, mark)));
  const recent = now - 600;
  // A picture alone has no words to know it by: the remote prompt with pictures that came after it was delivered.
  const there = (m: WbcMessage) =>
    m.text.trim()
      ? shown.some((x) => x.startsWith(flat(m.text).slice(0, 60)))
      : remote.some((x) => x.at >= (m.delivered_at ?? 0) - 60 && !!x.images?.length);
  return messages.filter((m) =>
    m.status !== 'delivered'
      ? (m.at ?? 0) > recent || m.status === 'queued' || m.status === 'waiting'
      : (m.delivered_at ?? 0) > recent && !there(m),
  );
}

/** What became of a line sent from here. */
export function statusWord(m: WbcMessage, t: WbcStrings): string {
  switch (m.status) {
    case 'queued':
      return t.sentWaiting;
    case 'waiting':
      return m.detail === 'typing'
        ? t.queuedTyping
        : m.detail === 'dialog'
          ? t.queuedDialog
          : m.detail === 'starting'
            ? t.queuedStarting
            : t.queuedWorking;
    case 'delivered':
      return t.delivered;
    case 'refused':
      return t.refused;
    case 'expired':
      return t.expired;
    default:
      return t.notDelivered + (m.error ? `: ${serverWords(m.error, t)}` : '');
  }
}

export function statusTone(m: WbcMessage): 'ok' | 'danger' | null {
  return m.status === 'delivered' ? 'ok' : m.status === 'waiting' || m.status === 'queued' ? null : 'danger';
}

/** Why the composer is a note in its place. */
export function whyText(s: Pick<WbcSession, 'why' | 'owner'>, t: WbcStrings): string {
  switch (s.why) {
    case 'not-yours':
      return t.why.notYours(s.owner?.name || t.itsPerson);
    case 'no-bridge':
      return t.why.noBridge;
    case 'remote-off':
      return t.why.remoteOff;
    case 'imp':
      return t.why.imp;
    case 'mismatch':
      return t.why.mismatch;
    default:
      return t.why.other;
  }
}

/** The server's own words in the app's language, where the web app has them. */
export function serverWords(text: string, t: WbcStrings): string {
  return t.server[text] ?? text;
}

/** A picture picked on the phone, waiting in the composer. */
export interface Picked {
  key: string;
  part: UploadPart;
  /** What the composer shows of it (a file uri, or the web's object URL). */
  uri: string;
  type: string;
  /** Its size in bytes when the picker says. */
  size?: number;
}

const EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** A picture's type: what the picker said, else by its name. */
export function pictureType(mime: string | null | undefined, name: string): string {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return m === 'image/jpg' ? 'image/jpeg' : m;
  const ext = name.toLowerCase().split('.').pop() || '';
  return EXT[ext] ?? m;
}

/**
 * The pictures that may go with the next message: png, jpeg, gif or webp, at
 * most `max` of `bytes` each (the server checks their bytes again). What is
 * left out says why, in `error`.
 */
export function admit(
  have: Picked[],
  got: Picked[],
  t: WbcStrings,
  r: WbcImageRules = IMAGE_RULES,
): { pics: Picked[]; error: string | null } {
  const out = [...have];
  let error: string | null = null;
  for (const p of got) {
    if (out.length >= r.max) {
      error = t.atMost(r.max);
      break;
    }
    if (!r.types.includes(p.type)) {
      error = t.onlyTypes;
      continue;
    }
    if (p.size != null && p.size > r.bytes) {
      error = t.tooLarge(Math.round(r.bytes / 1048576));
      continue;
    }
    out.push(p);
  }
  return { pics: out, error };
}
