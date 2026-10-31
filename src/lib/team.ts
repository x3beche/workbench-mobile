/**
 * A manager session's team - the agents under it and the tasks it gave them - as the web app's right-hand
 * column reads it (frontend/src/app/rooms/team-panel.ts): one answer from GET /api/agents/team/{manager}, read
 * and never written. The server sends some fields with more than one shape - a share or the pair behind it, the
 * work an agent holds or how much of it there is - so every reading here is defended, as the web's is.
 */
import type { TeamAgent, TeamTask } from '../api/types';
import type { LinkMap } from './agents';

/** The dot a row carries: what the agent or the task is doing now. */
export type TeamTone = 'live' | 'warn' | 'bad' | 'ok' | 'idle';

/** Working is the accent, waiting the warning, failed the error, answered the ok, the rest quiet. */
export function teamTone(state: string): TeamTone {
  if (state === 'working' || state === 'busy') return 'live';
  if (state === 'waiting' || state === 'waiting for the person') return 'warn';
  if (state === 'failed') return 'bad';
  if (state === 'answered') return 'ok';
  return 'idle';
}

/** How much of its window an agent is using: a share, or the used/limit pair behind it. */
export function pctOf(a: TeamAgent): number | null {
  const c = a.context as unknown;
  if (typeof c === 'number') return Math.round(c);
  if (c && typeof c === 'object') {
    const o = c as { pct?: number; used?: number; limit?: number };
    if (typeof o.pct === 'number') return Math.round(o.pct);
    if (typeof o.used === 'number' && typeof o.limit === 'number' && o.limit > 0) {
      return Math.round((o.used * 100) / o.limit);
    }
  }
  return null;
}

/** `open_tasks` arrives as the work it holds or as how much of it there is. */
export function openCount(a: TeamAgent): number {
  const n = a.open_tasks as unknown;
  if (typeof n === 'number') return n;
  if (Array.isArray(n)) return n.length;
  if (n && typeof n === 'object') {
    const o = n as { total?: number; items?: unknown[] };
    if (typeof o.total === 'number') return o.total;
    if (Array.isArray(o.items)) return o.items.length;
  }
  return 0;
}

/** The last six of a task's id: the table's own way of naming it ("#a1b2c3"). */
export function shortTask(id: string): string {
  return (id || '').slice(-6);
}

/** The work the manager's agents still hold (failed tasks are closed, as the web counts them). */
export function openTasks(tasks: TeamTask[]): TeamTask[] {
  return tasks.filter((x) => x.status !== 'closed' && x.status !== 'failed');
}

export function closedTasks(tasks: TeamTask[]): TeamTask[] {
  return tasks.filter((x) => x.status === 'closed' || x.status === 'failed');
}

/** Moments come in seconds or milliseconds depending on who wrote them: one reading here. */
function ms(v: number | null | undefined): number {
  if (!v) return 0;
  return v > 1e12 ? v : v * 1000;
}

/** "5m", "2h", "3d" - the row's own time, as the web's column says it; language-neutral. */
export function when(at: number | null | undefined, now: number = Date.now()): string {
  const t = ms(at);
  if (!t) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 90) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86_400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86_400)}d`;
}

/** How long a task took: from when it was given to its last change. */
export function took(created: number, updated: number): string {
  const s = Math.round(Math.max(0, ms(updated) - ms(created)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
}

/** How many sessions hang under a key, every level (a loop in the data ends the walk). */
export function countUnder(map: LinkMap, key: string): number {
  const seen = new Set([key]);
  let level = [key];
  let n = 0;
  while (level.length) {
    const next: string[] = [];
    for (const [w, m] of map) {
      if (!m || !level.includes(m) || seen.has(w)) continue;
      seen.add(w);
      next.push(w);
      n += 1;
    }
    level = next;
  }
  return n;
}
