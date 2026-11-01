/**
 * The director's layer on a live row, read for the screen: whether Jev (the cheap model behind the Office) had a
 * say, how sure it was, its face - and the "?" it puts over a head when it wants the person.
 *
 * The server adds these to `/api/office/live` only when the director's pick is fresh and confident
 * (`backend/office_director.py`, `blend`): `by: "jev"`, `confidence` (0-1), `mood: {name, level}`,
 * `detail` ("debugging", "reading docs"), `needs_manager: true` (with `bubble: "?"`), and `pose`, the place the
 * server would draw the character in. Without them the row is the rules' own and nothing here shows.
 */
import type { OfficeLiveAgent } from '../../api/types';

export type MoodName = 'calm' | 'focused' | 'frustrated';

export interface Mood {
  name: MoodName;
  level: number;
}

const MOODS: readonly MoodName[] = ['calm', 'focused', 'frustrated'];

/** The mood the server sent, or null when it sent none (or one this app does not know). */
export function moodOf(raw: unknown): Mood | null {
  if (!raw || typeof raw !== 'object') return null;
  const got = raw as Record<string, unknown>;
  const name = got.name;
  if (typeof name !== 'string' || !(MOODS as readonly string[]).includes(name)) return null;
  const level = typeof got.level === 'number' && Number.isFinite(got.level) ? Math.trunc(got.level) : 0;
  return { name: name as MoodName, level: Math.max(0, Math.min(2, level)) };
}

export interface Director {
  /** Jev refined this row (rather than the free rules alone). */
  jev: boolean;
  /** How sure it was, 0-1: the mark's number. */
  confidence: number | null;
  /** Its temper: the face on the character. */
  mood: Mood | null;
  /** Its word for what the agent is doing ("debugging"), under the activity in the card. */
  detail: string | null;
  /** It wants the person: a "?" over its head, unless the rules already send it to its manager. */
  needsManager: boolean;
  /** The place the server would draw it in ("desk", "kitchen", "lounge", "manager", "door"). */
  pose: string | null;
}

/** Everything the director said about one row, with the wire's own names read the way the web reads them. */
export function directorOf(row: Partial<OfficeLiveAgent> | null | undefined): Director {
  const by = row?.by;
  const detail = typeof row?.detail === 'string' && row.detail.trim() ? row.detail.trim() : null;
  const confidence = typeof row?.confidence === 'number' && Number.isFinite(row.confidence) ? row.confidence : null;
  const needsManager = row?.needs_manager === true || (row as { needsManager?: boolean })?.needsManager === true;
  return {
    jev: by === 'jev',
    confidence,
    mood: moodOf(row?.mood),
    detail,
    needsManager,
    pose: typeof row?.pose === 'string' && row.pose.trim() ? row.pose.trim() : null,
  };
}

/** The card's mark: "Jev", with how sure it was when the row says ("Jev · 82%"). */
export function jevLabel(confidence: number | null): string {
  return confidence == null ? 'Jev' : `Jev · ${Math.round(confidence * 100)}%`;
}

/**
 * The face's mouth, as the view draws it: a line, half a smile, or a frown. `level` (0-2) deepens it - a level
 * 0 mood is the ordinary face and shows nothing at all.
 */
export function moodMouth(mood: Mood | null): 'none' | 'flat' | 'smile' | 'frown' {
  if (!mood || mood.level <= 0) return 'none';
  if (mood.name === 'calm') return 'smile';
  if (mood.name === 'focused') return 'flat';
  return 'frown';
}

/** The bubble a row's head carries: the "?" the director asks with, or whatever the server put there. */
export function bubbleOf(row: Partial<OfficeLiveAgent> | null | undefined, fallback: string | null): string | null {
  if (directorOf(row).needsManager) return '?';
  return typeof row?.bubble === 'string' && row.bubble.trim() ? row.bubble : fallback;
}
