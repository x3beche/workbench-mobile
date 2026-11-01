/**
 * How far a character's task is, read from the card's row: the share and how wide it is, and the time left in the
 * bucket the measurement gave ("<5m", "15-60m") - the app's own `TaskProgress` (`src/api/types.ts`), which
 * `backend/office.py` passes through as it keeps it.
 *
 * A row from an older server carries a plain percent instead (no spread, no time left), and the screen draws the
 * bar without a "~" or a bucket rather than inventing either.
 */
import type { OfficeTask, TaskProgress } from '../../api/types';

export const ETAS = ['<5m', '5-15m', '15-60m', '>1h'] as const;

export interface TaskShare {
  /** 0-100: the share done, whole. */
  percent: number;
  /** How wide the estimate is, in points (null when the row did not say). Wide means low confidence. */
  spread: number | null;
  /** How long is left, in its bucket; null when the estimate did not give one. */
  eta: (typeof ETAS)[number] | null;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** The spread in points: the server's own figure, or a fraction at most 1 read as one (lib/team.ts's rule). */
function spreadPoints(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const points = raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.round(points));
}

/** The task's share as the card draws it, or null when there is nothing to draw. */
export function shareOf(task: OfficeTask | null | undefined): TaskShare | null {
  const raw: unknown = task?.progress;
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { percent: clampPct(raw), spread: null, eta: null } : null;
  }
  if (typeof raw !== 'object') return null;
  const block = raw as Partial<TaskProgress> & Record<string, unknown>;
  const percent = typeof block.percent === 'number' && Number.isFinite(block.percent) ? block.percent : null;
  if (percent == null) return null;
  const eta = typeof block.eta === 'string' && (ETAS as readonly string[]).includes(block.eta)
    ? (block.eta as TaskShare['eta'])
    : null;
  return { percent: clampPct(percent), spread: spreadPoints(block.spread), eta };
}
