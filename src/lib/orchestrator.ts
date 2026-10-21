/**
 * The Orchestrator as the app shows it (backend/orchestrator; the web app's
 * rooms/orchestrator-room.ts and orchestrator-card.ts): its state in words,
 * its sub-agents as a tree, a session's transcript kept up by the live
 * stream, a tool call read in a few words, and the lines it said in a room
 * shown as the answers they are.
 */
import type {
  AgentNode,
  AgentTree,
  McpCatalog,
  OrchEvent,
  OrchMessage,
  OrchPart,
  OrchStatus,
  OrchTranscript,
} from '../api/types';
import type { OrchStrings } from './orchStrings';

/** A transcript keeps at most this many messages while the stream adds to it (the web app's MAX_MSGS). */
export const MAX_MSGS = 200;

/** The state in a word: Running, Starting…, Restarting…, Stopped. */
export function stateWord(s: OrchStatus | null, t: OrchStrings): string {
  if (!s) return '…';
  return (
    {
      running: t.running,
      starting: t.starting,
      restarting: t.restarting,
      stopped: t.stopped,
      halted: t.stopped,
    }[s.state] ?? s.state
  );
}

export type Dot = 'running' | 'idle' | 'retry' | 'error' | 'stopped' | 'done';

/** The dot beside the state: idle while it runs and waits, amber while it starts, red when the provider stopped it. */
export function statusDot(s: OrchStatus): Dot {
  if (s.halted) return 'error';
  if (s.state === 'running') return 'idle';
  if (s.state === 'stopped') return 'stopped';
  return 'retry';
}

/** Why it stopped, in a heading: the key, the credits, or simply stopped. */
export function haltTitle(kind: string, t: OrchStrings): string {
  return kind === 'auth' ? t.keyRejected : kind === 'credit' ? t.creditsOut : t.stopped;
}

/** What went wrong last, by the supervisor's word for it. */
export function failureWord(kind: string, t: OrchStrings): string {
  return t.kinds[kind] ?? kind;
}

export interface TreeRow {
  n: AgentNode;
  depth: number;
}

/** The tree in reading order: the Orchestrator first, each sub-agent under the one that started it, newest first. */
export function treeRows(tree: AgentTree | null): TreeRow[] {
  if (!tree?.root) return [];
  const kids = new Map<string, AgentNode[]>();
  for (const n of tree.nodes) if (n.parentID) kids.set(n.parentID, [...(kids.get(n.parentID) ?? []), n]);
  const out: TreeRow[] = [];
  const seen = new Set<string>();
  const walk = (n: AgentNode, depth: number) => {
    if (seen.has(n.id) || depth > 8) return;
    seen.add(n.id);
    out.push({ n, depth });
    const mine = [...(kids.get(n.id) ?? [])].sort((a, b) => (b.started ?? 0) - (a.started ?? 0));
    for (const k of mine) walk(k, depth + 1);
  };
  const root = tree.nodes.find((n) => n.id === tree.root);
  if (root) walk(root, 0);
  return out;
}

/** How many sub-agents are at work now. */
export function busyAgents(rows: TreeRow[]): number {
  return rows.filter((r) => r.depth > 0 && (r.n.state === 'running' || r.n.state === 'retry')).length;
}

/** A room's name as a person reads it, by the id the tools use. */
export function roomName(id: string | undefined, t: OrchStrings): string {
  return (id && t.rooms[id]) || id || t.aRoom;
}

/** A line it said in a room (a `say` tool call): shown as the answer it is, not as a tool call. */
export function said(p: OrchPart, t: OrchStrings): { room: string; text: string } | null {
  if (p.type !== 'tool' || !p.tool || !/(^|_)say$/.test(p.tool) || !p.input) return null;
  try {
    const a = JSON.parse(p.input);
    return typeof a?.text === 'string' ? { room: roomName(a.room, t), text: a.text } : null;
  } catch {
    return { room: t.aRoom, text: p.input };
  }
}

/** A tool's name without the server it came from: "workbench_model_build" -> "model_build". */
export function shortTool(name: string | undefined): string {
  return (name ?? '').replace(/^(workbench|cad|pcb|firmware)_/, '');
}

export function toolName(p: OrchPart, t: OrchStrings): string {
  return p.tool === 'task' ? t.handToAgent : shortTool(p.tool);
}

/** The call's arguments in a few words. */
export function toolArgs(p: OrchPart): string {
  if (p.title) return p.title;
  if (!p.input) return '';
  try {
    const a = JSON.parse(p.input) as Record<string, unknown>;
    if (p.tool === 'task') return [a.subagent_type, a.description].filter(Boolean).join(' · ');
    return Object.entries(a)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(', ')
      .slice(0, 140);
  } catch {
    return p.input.slice(0, 140);
  }
}

export function toolState(status?: string): Dot {
  return status === 'running' || status === 'pending' ? 'running' : status === 'error' ? 'error' : 'done';
}

/** What a session in the tree does now, on the line under its name. */
export function stepText(n: AgentNode, t: OrchStrings): string {
  const s = n.last_step;
  if (n.state === 'error' && n.error) return n.error;
  if (!s) return n.state === 'running' ? t.working : n.parentID ? t.done : t.waiting;
  if (s.kind === 'tool') return shortTool(s.tool) + (s.text ? ` · ${s.text}` : '');
  if (s.kind === 'thinking') return t.thinking + (s.text ? ` · ${s.text}` : '');
  return s.text;
}

/** A length of time: 42s, 3m 5s, 1h 12m. */
export function span(a: number, b: number): string {
  const s = Math.max(0, Math.round((b - a) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** How long a session has run: still counting while it works. */
export function nodeTime(n: AgentNode, now: number): string {
  if (!n.started) return '';
  const live = n.state === 'running' || n.state === 'retry';
  return span(n.started, live ? now : (n.updated ?? n.started));
}

/** Why a transcript is empty, in words. */
export function reasonText(r: string, t: OrchStrings): string {
  return t.reasons[r] ?? t.reasons.other;
}

/** Who wrote a message: the Orchestrator, a sub-agent by its kind, or Workbench handing it a line. */
export function author(m: OrchMessage, sub: boolean, t: OrchStrings): string {
  if (m.role === 'assistant') return m.agent === 'orchestrator' || !m.agent ? t.orchestrator : m.agent;
  return sub ? t.itsTask : 'Workbench';
}

/** The last part of a message still being written (its thinking stays open while it is). */
export function isLive(m: OrchMessage, p: OrchPart): boolean {
  return !m.done && m.parts[m.parts.length - 1] === p;
}

/**
 * What of a text delta a part does not hold yet (the web app's deltaPast):
 * all of it without a place (`o`), only its tail when the part has its
 * start already, all of it when the part has less (a piece missed - the
 * part's next update mends it).
 */
export function deltaPast(have: string, delta: string, o?: number): string {
  if (typeof o !== 'number' || o >= have.length) return delta;
  return delta.slice(have.length - o);
}

/**
 * One event of the live stream on the transcript shown: a message begun or
 * finished, a part written or replaced, a few more characters, something
 * taken away. Anything about another session leaves it as it was (the same
 * object), which is how the caller knows nothing changed.
 */
export function applyEvent(x: OrchTranscript, e: OrchEvent, shown: string | null): OrchTranscript {
  if (!['message', 'part', 'delta', 'removed'].includes(e.type) || !e.session || e.session !== shown) return x;
  const msgs = [...x.messages];
  const mid = e.type === 'message' ? e.id : e.message;
  if (!mid) return x;
  let i = msgs.findIndex((m) => m.id === mid);
  if (e.type === 'removed') {
    if (i < 0) return x;
    const partId = typeof e.part === 'string' ? e.part : null;
    if (partId) msgs[i] = { ...msgs[i], parts: msgs[i].parts.filter((p) => p.id !== partId) };
    else msgs.splice(i, 1);
    return { ...x, messages: msgs };
  }
  if (i < 0) {
    msgs.push({
      id: mid,
      role: e.role ?? 'assistant',
      agent: e.agent ?? null,
      time: e.time ?? Date.now(),
      done: null,
      parts: [],
    });
    i = msgs.length - 1;
    if (msgs.length > MAX_MSGS) {
      msgs.shift();
      i--;
    }
  }
  const m = { ...msgs[i] };
  if (e.type === 'message') {
    if (e.role) m.role = e.role;
    m.agent = e.agent ?? m.agent;
    m.time = e.time ?? m.time;
    m.done = e.done ?? null;
    if (e.error) m.error = e.error;
  } else if (e.type === 'part') {
    if (!e.part || typeof e.part !== 'object' || !e.id) return x;
    const np: OrchPart = { ...e.part, id: e.id };
    const k = m.parts.findIndex((p) => p.id === e.id);
    m.parts = k < 0 ? [...m.parts, np] : m.parts.map((p, j) => (j === k ? np : p));
  } else {
    const pid = typeof e.part === 'string' ? e.part : null;
    if (!pid || typeof e.delta !== 'string') return x;
    const k = m.parts.findIndex((p) => p.id === pid);
    if (k < 0) m.parts = [...m.parts, { id: pid, type: 'text', text: e.delta }];
    else {
      const add = deltaPast(m.parts[k].text ?? '', e.delta, e.o);
      if (!add) return x;
      m.parts = m.parts.map((p, j) => (j === k ? { ...p, text: (p.text ?? '') + add } : p));
    }
  }
  msgs[i] = m;
  return { ...x, messages: msgs };
}

/** The tools whose name, description or parameters hold every word asked for, by group. */
export function findTools(c: McpCatalog | null, q: string): McpCatalog['groups'] {
  if (!c) return [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return c.groups
    .map((g) => ({
      ...g,
      tools: g.tools.filter((tl) => {
        const hay = `${tl.name} ${tl.description} ${tl.params.map((p) => `${p.name} ${p.description}`).join(' ')}`;
        const low = hay.toLowerCase();
        return words.every((w) => low.includes(w));
      }),
    }))
    .filter((g) => g.tools.length);
}

/** A clock time for a message (milliseconds since 1970). */
export function clockOf(ms: number, lang: 'en' | 'tr'): string {
  try {
    return new Date(ms).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/** A day and time for "since …" and when it last failed. */
export function whenOf(at: string | null, lang: 'en' | 'tr'): string {
  if (!at) return '-';
  const d = new Date(at);
  if (Number.isNaN(+d)) return '-';
  try {
    return d.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}
