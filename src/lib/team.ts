/**
 * A manager session's team - the agents under it and the tasks it gave them - as the web app's right-hand
 * column reads it (frontend/src/app/rooms/team-panel.ts): one answer from GET /api/agents/team/{manager}, read
 * and never written. The server sends some fields with more than one shape - a share or the pair behind it, the
 * work an agent holds or how much of it there is - so every reading here is defended, as the web's is.
 */
import type { TeamAgent, TeamTask } from '../api/types';
import type { TeamStrings } from './teamStrings';
import type { LinkMap } from './agents';

/** The dot a row carries, as the person reads it: working is the good green and breathes, waiting asks for
 *  them, an interrupted or failed one is the error, the rest (idle, at its prompt) is a quiet hollow ring. */
export type TeamTone = 'ok' | 'warn' | 'bad' | 'idle';

export function dotTone(state: string): TeamTone {
  const s = (state || '').toLowerCase();
  if (s === 'working' || s === 'busy' || s === 'starting') return 'ok';
  if (s.startsWith('waiting')) return 'warn';
  if (s === 'interrupted' || s === 'failed' || s === 'offline' || s === 'stalled') return 'bad';
  return 'idle';
}

/** The order the list keeps: what waits on the person first, then what works, then what sits idle. */
export function agentRank(state: string): number {
  const s = (state || '').toLowerCase();
  if (s.startsWith('waiting') || s === 'interrupted' || s === 'failed' || s === 'stalled' || s === 'offline') return 0;
  if (s === 'working' || s === 'busy' || s === 'starting') return 1;
  return 2;
}

export function agentsInOrder(agents: TeamAgent[]): TeamAgent[] {
  return agents
    .map((a, i) => ({ a, i }))
    .sort((x, y) => agentRank(x.a.state) - agentRank(y.a.state) || x.i - y.i)
    .map((x) => x.a);
}

/** How much of its window an agent is using, as a whole percent, and possibly past 100: the server's `pct` is
 *  capped at 100 and can lag a window that changed, so the share is worked out from the used/limit pair first
 *  and `pct` is only the fallback when the pair is missing. */
export function pctOf(a: TeamAgent): number | null {
  const c = a.context as unknown;
  if (typeof c === 'number') return Math.round(c);
  if (c && typeof c === 'object') {
    const o = c as { pct?: number; used?: number; limit?: number };
    if (typeof o.used === 'number' && typeof o.limit === 'number' && o.limit > 0) {
      return Math.round((o.used * 100) / o.limit);
    }
    if (typeof o.pct === 'number') return Math.round(o.pct);
  }
  return null;
}

/** The bar's tone: the quiet ink until it is nearly full, amber past 80 %, the error past 95 %. */
export function barTone(pct: number | null): '' | 'warn' | 'bad' {
  if (pct == null) return '';
  if (pct > 95) return 'bad';
  if (pct > 80) return 'warn';
  return '';
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
function millis(v: number | null | undefined): number {
  if (!v) return 0;
  return v > 1e12 ? v : v * 1000;
}

/** "3s", "12m", "1h 4m", "3d" for a span of milliseconds. */
export function dur(ms: number): string {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  return `${Math.round(s / 86_400)}d`;
}

/** How long ago a moment was: "5m", "2h", "3d" - the row's own age, as the web's column says it. */
export function when(at: number | null | undefined, now: number = Date.now()): string {
  const t = millis(at);
  if (!t) return '';
  return dur(now - t);
}

/** The one number beside a task's state: how long it has been going while it works or waits (from its line to
 *  now), and how long it took once it answered (from its line to its last change). */
export function took(task: TeamTask, now: number = Date.now()): string {
  const running = task.status === 'working' || task.status === 'waiting' || task.status === 'queued';
  const from = millis(task.created);
  return dur(running ? now - from : millis(task.updated) - from);
}

/** The tasks an agent holds: the ids its own list names, in the order the tasks list sends them; a server that
 *  sends only a count leaves the open tasks filtered by the agent. */
export function tasksOf(a: TeamAgent, open: TeamTask[]): TeamTask[] {
  const n = a.open_tasks as unknown;
  const ids = Array.isArray(n)
    ? n.map((x) => (typeof x === 'string' ? x : (x as { task?: string }).task || '')).filter(Boolean)
    : [];
  if (!ids.length) return open.filter((t) => t.agent === a.agent);
  return ids
    .map((id) => open.find((t) => t.task === id))
    .filter((t): t is TeamTask => !!t);
}

/** What an agent closed last, for the one line it gets when it holds nothing. */
export function lastClosed(agent: string, closed: TeamTask[]): TeamTask | null {
  const rows = closed.filter((t) => t.agent === agent);
  return rows.sort((x, y) => millis(y.updated) - millis(x.updated))[0] ?? null;
}

/** A text flattened for the one-line clamp: its markup gone (headings, emphasis, backticks, list marks,
 *  links keeping their words), so what the sheet shows is what the answer says. */
export function oneLine(text: string): string {
  return (text || '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The one dim line under a task: what its agent reported, else what it answered. */
export function reportLine(task: TeamTask, t: TeamStrings): string {
  const rows = task.reports || [];
  const last = rows.length ? rows[rows.length - 1] : null;
  if (last) return `${t.reported} ${t.status(last.status)} · ${oneLine(last.summary)}`;
  const answer = oneLine(task.answer || '');
  return answer ? `${t.status(task.status)} · ${answer}` : '';
}

/** The line an agent that holds nothing gets: what it closed last, if anything. */
export function idleLine(state: string, last: TeamTask | null, t: TeamStrings, now: number = Date.now()): string {
  const word = state && state !== 'idle' ? t.status(state) : t.idle;
  if (!last) return `${word} · ${t.noTaskYet}`;
  return `${word} · ${t.lastTask} #${shortTask(last.task)} ${t.status(last.status)} ${when(last.updated, now)}`;
}

/** The closed tasks grouped by the agent that held them, in the list's own order. */
export function groupClosed(agents: TeamAgent[], closed: TeamTask[]): { agent: string; name: string; tasks: TeamTask[] }[] {
  const out = agents
    .map((a) => ({ agent: a.agent, name: a.name, tasks: closed.filter((t) => t.agent === a.agent) }))
    .filter((g) => g.tasks.length);
  const known = new Set(agents.map((a) => a.agent));
  for (const task of closed) {
    if (known.has(task.agent)) continue;
    let g = out.find((x) => x.agent === task.agent);
    if (!g) out.push((g = { agent: task.agent, name: task.agent_name || task.agent, tasks: [] }));
    g.tasks.push(task);
  }
  return out;
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
