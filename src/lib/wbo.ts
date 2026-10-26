/**
 * The OpenCode sessions, without drawing them: one's own OpenCode runs under
 * wb-opencode (backend/wbopencode.py), as the web app's Chat shows them
 * (frontend/src/app/rooms/opencode-sessions.ts) - what a run is doing in
 * words and as a dot, which sessions the drawer lists, the conversation as
 * the Chat draws an answer (its thinking, its words, its tool calls as step
 * rows), the live changes of the account's S2 stream `wbo` laid onto it,
 * the lines sent from here until the conversation shows them, and what
 * OpenCode asks (a form of questions, a permission) with the answer chosen.
 */
import type { Step, WboAsk, WboDetail, WboField, WboMsg, WboPart, WboSend, WboSession } from '../api/types';
import { deltaPast, type Dot } from './orchestrator';
import type { RunStats } from './runStats';
import type { WboStrings } from './wboStrings';

/** Messages kept while one is followed live (the server sends at most 120). */
export const MAX_MSGS = 200;
/** Turns shown at first and added at a time, as a room's lines. */
export const TURNS_PAGE = 10;

/** What a run is doing, in words. */
export function wboWord(s: Pick<WboSession, 'status' | 'bridge'> | null, t: WboStrings): string {
  if (!s?.bridge?.connected) return t.notConnected;
  if (s.status === 'waiting') return t.waitingAnswer;
  if (s.status === 'busy') return t.working;
  if (s.status === 'retry') return t.retrying;
  return t.ready;
}

/** The live dot: pulsing while OpenCode works, amber while it waits for an answer or retries, green ready; none unconnected. */
export function wboDot(s: Pick<WboSession, 'status' | 'bridge'> | null | undefined): Dot | null {
  if (!s?.bridge?.connected) return null;
  if (s.status === 'waiting' || s.status === 'retry') return 'retry';
  if (s.status === 'busy') return 'running';
  return 'idle';
}

/** What a row says under its name: what it needs from the person, and nothing
 *  at all while it is working or only ready - the dot says both, and it is the
 *  dot that pulses while a run is under way (the web's wboLine). Left out with
 *  a session whose wb-opencode is gone for the same reason: 41 names with "not
 *  connected" under every one of them is a list nobody reads. */
export function wboLine(s: Pick<WboSession, 'status' | 'bridge'> | null, t: WboStrings): string | null {
  if (!s?.bridge?.connected) return null;
  if (s.status === 'waiting') return t.waitingAnswer;
  if (s.status === 'retry') return t.retrying;
  return null;
}

/** A folded group's one dot: working before waiting before ready. */
export function groupDot(dots: (Dot | null)[]): Dot | null {
  if (dots.includes('running')) return 'running';
  if (dots.includes('retry')) return 'retry';
  return dots.some(Boolean) ? 'idle' : null;
}

/** The drawer's: connected ones, the last day's, the open one and the pinned ones; a search narrows them by name and computer. */
export function shownWbo(
  rows: WboSession[],
  q = '',
  open: string | null = null,
  pinned: (id: string) => boolean = () => false,
  now = Date.now(),
): WboSession[] {
  const words = q.trim().toLowerCase();
  const day = now - 86_400_000;
  return rows.filter(
    (s) =>
      (s.bridge?.connected || (s.updated ?? 0) > day || s.session_id === open || pinned(s.session_id)) &&
      (!words ||
        s.name.toLowerCase().includes(words) ||
        (s.computer || '').toLowerCase().includes(words) ||
        'opencode'.includes(words)),
  );
}

// ---- the conversation as the Chat draws it ------------------------------------

/** One piece of OpenCode's answer: its thinking, its words, a run of tool calls, a question, an error. */
export type TurnItem =
  | { t: 'think'; key: string; text: string; live: boolean; ms?: number }
  | { t: 'text'; key: string; text: string; live: boolean }
  | { t: 'steps'; key: string; steps: Step[] }
  | { t: 'ask'; key: string; ask: WboAsk }
  | { t: 'error'; key: string; text: string };

export type Turn =
  | { kind: 'user'; id: string; msg: WboMsg }
  | {
      kind: 'assistant';
      id: string;
      items: TurnItem[];
      live: boolean;
      writing: boolean;
      time: number | null;
      model: string | null;
      /** The model's provider, as OpenCode names it ("workbench", "opencode"...). */
      provider: string | null;
      /** Its own messages: one turn may be several of OpenCode's steps, and
       *  the stats under it are all of them together. */
      steps: WboMsg[];
    };

/** An OpenCode tool call as the Chat's own step row: "bash · npm test", what it gave back when opened. */
export function toStep(p: WboPart): Step {
  const status = p.status === 'error' ? 'error' : p.status === 'completed' ? 'done' : 'running';
  const tool = p.tool || 'tool';
  return {
    id: p.id,
    tool,
    status,
    // The words go in as values: a command's own braces are never read as the sentence's slots.
    say: p.title ? '{tool} · {title}' : '{tool}',
    vars: p.title ? { tool, title: p.title } : { tool },
    summary: p.output || p.input || undefined,
    error: p.error || undefined,
    ms: p.start && p.end ? p.end - p.start : undefined,
  };
}

/**
 * Rows: each person's message, and each run of OpenCode's messages (its
 * steps, one message each) as one answer - its thinking, words and tool
 * calls in order; a tool call OpenCode asks with is its card instead (a
 * permission keeps its step row too).
 */
export function buildTurns(msgs: WboMsg[], asks: WboAsk[] = []): Turn[] {
  const byPart = new Map(asks.filter((a) => a.part).map((a) => [a.part as string, a]));
  const out: Turn[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (m.role === 'user') {
      out.push({ kind: 'user', id: m.id, msg: m });
      continue;
    }
    let tn = last?.kind === 'assistant' ? last : null;
    if (!tn) {
      tn = {
        kind: 'assistant',
        id: m.id,
        items: [],
        live: false,
        writing: false,
        time: m.time,
        model: m.model ?? null,
        provider: m.provider ?? null,
        steps: [],
      };
      out.push(tn);
    }
    tn.model = m.model ?? tn.model;
    tn.provider = m.provider ?? tn.provider;
    tn.steps.push(m);
    tn.live = !m.done;
    tn.writing = false;
    m.parts.forEach((p, i) => {
      const lastPart = !m.done && i === m.parts.length - 1;
      const key = m.id + p.id;
      if (p.type === 'reasoning')
        tn.items.push({
          t: 'think',
          key,
          text: p.text ?? '',
          live: lastPart,
          ms: p.start && p.end ? p.end - p.start : undefined,
        });
      else if (p.type === 'text') {
        tn.items.push({ t: 'text', key, text: p.text ?? '', live: lastPart });
        if (lastPart) tn.writing = true;
      } else if (p.type === 'tool') {
        // OpenCode's question tool is always the card: the ask the bridge told, else one drawn from the call itself
        const a = byPart.get(p.id) ?? (p.tool === 'question' ? toolAsk(p) : undefined);
        if (!a || a.kind === 'permission') {
          const prev = tn.items[tn.items.length - 1];
          if (prev?.t === 'steps') prev.steps.push(toStep(p));
          else tn.items.push({ t: 'steps', key, steps: [toStep(p)] });
        }
        if (a) tn.items.push({ t: 'ask', key: 'ask' + a.id, ask: a });
      }
    });
    if (m.error) tn.items.push({ t: 'error', key: m.id + 'err', text: m.error });
  }
  return out;
}

/** What the question tool's output says was chosen, by field: its text is
 *  `User has answered your questions: "<question>"="<a, b>", ... You can now continue ...` ("Unanswered" for none). */
export function toolAnswers(fields: WboField[], out: string): Record<string, unknown> {
  const ans: Record<string, unknown> = {};
  fields.forEach((f, i) => {
    const head = `"${f.description}"="`;
    const at = out.indexOf(head);
    if (at < 0) return;
    const from = at + head.length;
    const next = i + 1 < fields.length ? out.indexOf(`", "${fields[i + 1].description}"="`, from) : -1;
    const end = next >= 0 ? next : out.lastIndexOf('". You can now continue');
    const v = end >= from ? out.slice(from, end) : '';
    if (v && v !== 'Unanswered') ans[f.key] = v;
  });
  return ans;
}

/**
 * The question tool's call as a card when no ask of it is known (a
 * wb-opencode before 0.2.0 does not forward OpenCode's forms, or the form is
 * not here yet): its questions from the input ({questions: [{header,
 * question, options: [{label, description}], multiple, custom}]} - the form
 * OpenCode makes of it has field q<i> each), and once the call has ended,
 * what was chosen from its output.
 */
export function toolAsk(p: WboPart): WboAsk {
  let qs: unknown[] = [];
  try {
    const a = JSON.parse(p.input || '{}');
    if (Array.isArray(a?.questions)) qs = a.questions;
  } catch {
    // still being written
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const fields: WboField[] = qs
    .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
    .map((q, i) => ({
      key: 'q' + i,
      type: q.multiple === true || q.multiSelect === true ? 'multiselect' : 'string',
      title: str(q.header),
      description: str(q.question),
      custom: q.custom !== false,
      required: false,
      options: (Array.isArray(q.options) ? q.options : [])
        .map((o: { label?: unknown; description?: unknown } | null) => ({
          value: str(o?.label),
          label: str(o?.label),
          description: str(o?.description),
        }))
        .filter((o) => o.label),
    }));
  const done = p.status === 'completed';
  const failed = p.status === 'error';
  const answer = done ? toolAnswers(fields, p.output ?? '') : null;
  // Times in seconds, as an ask's.
  const sec = (ms?: number) => (ms ? ms / 1000 : null);
  return {
    id: 'tool-' + p.id,
    kind: 'form',
    fields,
    part: p.id,
    local: true,
    at: sec(p.start),
    settled_at: sec(p.end),
    status: done ? 'answered' : failed ? 'cancelled' : 'pending',
    answer,
    error: failed ? (p.error ?? null) : null,
    raw: done && !Object.keys(answer ?? {}).length ? (p.output ?? '') : undefined,
  };
}

/** Why a card drawn from the tool's call is not answered here: an older wb-opencode, or nothing to hand the answer to. */
export function localWhy(s: Pick<WboSession, 'bridge'> | null | undefined, t: WboStrings): string {
  return s?.bridge && s.bridge.answers === false ? t.updateToAnswer : t.answerOnComputer;
}

/** The header's "Update wb-opencode 0.1.0 → 0.2.0", while that computer's is older than the server's; else null. */
export function updateWord(s: Pick<WboSession, 'bridge'> | null | undefined, t: WboStrings): string | null {
  const b = s?.bridge;
  if (!b?.outdated) return null;
  return b.version && b.latest ? `${t.updateWboTitle} ${b.version} → ${b.latest}` : t.updateWboTitle;
}

/** The ids of the messages that came from Workbench (OpenCode's id of each line delivered). */
export function remoteIds(sends: WboSend[]): Set<string> {
  return new Set(sends.map((m) => m.inbox).filter((x): x is string => !!x));
}

/** The line from Workbench that became this message, if one did. */
export function sendOf(sends: WboSend[], mid: string): WboSend | null {
  return sends.find((x) => x.inbox === mid) ?? null;
}

/** Lines on their way, and the failed ones of the last ten minutes, not yet in the conversation. */
export function pendingSends(sends: WboSend[], msgs: WboMsg[], now = Date.now() / 1000): WboSend[] {
  const have = new Set(msgs.map((m) => m.id));
  const recent = now - 600;
  return sends.filter(
    (m) =>
      m.status === 'queued' ||
      (m.status === 'delivered' && !!m.inbox && !have.has(m.inbox) && (m.delivered_at ?? 0) > recent) ||
      (m.status !== 'delivered' && (m.at ?? 0) > recent),
  );
}

/** What OpenCode asks whose tool call is in no message held: the open ones and those settled in the last hour. */
export function looseAsks(asks: WboAsk[], msgs: WboMsg[], now = Date.now() / 1000): WboAsk[] {
  const parts = new Set(msgs.flatMap((m) => m.parts.map((p) => p.id)));
  const hour = now - 3600;
  return asks.filter(
    (a) =>
      (!a.part || !parts.has(a.part)) &&
      (a.status === 'pending' || a.status === 'answering' || (a.settled_at ?? 0) > hour),
  );
}

/** The model of the last answer. */
export function lastModel(msgs: WboMsg[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant' && msgs[i].model) return msgs[i].model!;
  return null;
}

// ---- how the run came: the line under it, and the card it opens ------------------

/** When a message's first token came: the earliest piece of it that began, for
 *  one kept before its events had the time (an answer from before this was
 *  kept gets it from its pieces, or not at all). */
function firstPiece(m: WboMsg): number | null {
  const began = m.parts
    .filter((p) => p.type === 'text' || p.type === 'reasoning')
    .map((p) => p.start)
    .filter((x): x is number => !!x);
  return began.length ? Math.min(...began) : null;
}

/** How long a message's thinking took: each piece of it from its own start to
 *  the next piece's, or to the message's end. */
function thinkMs(m: WboMsg): number {
  let n = 0;
  m.parts.forEach((p, i) => {
    if (p.type !== 'reasoning' || !p.start) return;
    const from = p.start;
    const next = m.parts.slice(i + 1).find((q) => q.start && q.start > from)?.start ?? m.done ?? null;
    if (next) n += Math.max(0, next - from);
  });
  return n;
}

/** The provider as a person reads it: OpenCode's own ids, the app's gateway
 *  among them ("workbench", backend/llm_gateway.py), and the id itself when it
 *  is one nobody here named (the web's PROV_NAME). */
const PROV_NAME = new Map([
  ['commandcode', 'Command Code'],
  ['openrouter', 'OpenRouter'],
  ['claude', 'Claude API'],
  ['opencode-go', 'OpenCode Go'],
  ['workbench', 'Workbench'],
]);

export function provName(p?: string | null): string | null {
  return p ? (PROV_NAME.get(p) ?? p) : null;
}

/**
 * The turn's stats: its steps together - what went in and out of all of them,
 * its first token and its end - and the window as it stood at the end, which
 * is the last step's. A turn is several of OpenCode's model calls (a step
 * each) and reads as one answer, so it is counted as one.
 */
export function turnStats(
  tn: Extract<Turn, { kind: 'assistant' }>,
  window: (model?: string | null) => number | null = () => null,
): RunStats | null {
  const steps = tn.steps ?? [];
  const sent = steps.map((m) => m.time).filter((x): x is number => !!x);
  const dones = steps.map((m) => m.done).filter((x): x is number => !!x);
  if (!sent.length || !dones.length) return null;
  const sum = (f: (m: WboMsg) => number | null | undefined) => steps.reduce((n, m) => n + (f(m) ?? 0), 0);
  const firsts = steps.map((m) => m.first ?? firstPiece(m)).filter((x): x is number => !!x);
  const last = steps[steps.length - 1];
  const read = sum((m) => m.tok?.[2]) || null;
  const into = sum((m) => m.tok?.[0]);
  // Where the window stood when the run ended: the last step's prompt, not the steps added up.
  const held = (last.tok?.[0] ?? 0) + (last.tok?.[2] ?? 0);
  return {
    sent: Math.min(...sent),
    first: firsts.length ? Math.min(...firsts) : null,
    done: Math.max(...dones),
    out: sum((m) => m.tok?.[1]) || null,
    input: into + (read ?? 0) || null,
    cacheRead: read,
    cacheWrite: sum((m) => m.tok?.[3]) || null,
    thinkingChars:
      sum((m) => m.parts.filter((p) => p.type === 'reasoning').reduce((n, p) => n + (p.text?.length ?? 0), 0)) || null,
    thinkingMs: steps.reduce((n, m) => n + thinkMs(m), 0) || null,
    context: window(last.model ?? tn.model),
    contextTokens: held || null,
    model: last.model ?? tn.model ?? null,
    provider: provName(last.provider ?? tn.provider),
    error: [...steps].reverse().find((m) => m.error)?.error ?? null,
  };
}

// ---- live: the account's S2 stream `wbo` ----------------------------------------

/** A record of the stream `wbo` (backend/wbopencode.py Book.told). */
export interface WboEvent {
  type: 'message' | 'part' | 'delta' | 'ask' | 'status' | 'session' | 'error' | string;
  session?: string;
  id?: string;
  message?: string;
  role?: 'user' | 'assistant';
  agent?: string | null;
  model?: string | null;
  provider?: string | null;
  time?: number | null;
  /** When its first token came, and what it spent by the end of the step. */
  first?: number | null;
  tok?: [number, number, number, number] | null;
  done?: number | null;
  error?: string;
  part?: WboPart | string;
  delta?: string;
  o?: number;
  ask?: WboAsk;
  status?: WboSession['status'];
  title?: string;
}

/** An ask as it is now, put into the session: its state follows (waiting while one is open). */
export function putAsk(s: WboDetail, a: WboAsk): WboDetail {
  const asks = s.asks ?? [];
  const i = asks.findIndex((x) => x.id === a.id);
  const next = i < 0 ? [...asks, a] : asks.map((x, j) => (j === i ? a : x));
  const waiting = next.some((x) => x.status === 'pending' || x.status === 'answering');
  const status = waiting ? 'waiting' : s.status === 'waiting' ? 'busy' : s.status;
  return { ...s, asks: next, status: s.bridge?.connected ? status : s.status };
}

/**
 * One record of the stream laid onto the session shown. `read`: what it says
 * cannot be laid on (an error), the session is read again. Anything about
 * another session leaves both as they were (the same objects).
 */
export function applyWbo(
  s: WboDetail | null,
  msgs: WboMsg[],
  e: WboEvent,
  sid: string,
): { s: WboDetail | null; msgs: WboMsg[]; read?: boolean } {
  const same = { s, msgs };
  if (!e || typeof e !== 'object') return same;
  if (e.type === 'session') {
    if (e.id !== sid || !s) return same;
    return { s: { ...s, title: e.title ?? s.title, name: e.title || s.name }, msgs };
  }
  if (e.session !== sid) return same;
  if (e.type === 'status') return s && e.status ? { s: { ...s, status: e.status }, msgs } : same;
  if (e.type === 'error') return { ...same, read: true };
  if (e.type === 'ask') return s && e.ask?.id ? { s: putAsk(s, e.ask), msgs } : same;
  if (!['message', 'part', 'delta'].includes(e.type)) return same;
  const mid = e.type === 'message' ? e.id : e.message;
  if (!mid) return same;
  const next = [...msgs];
  let i = next.findIndex((m) => m.id === mid);
  if (i < 0) {
    next.push({
      id: mid,
      role: e.role ?? 'assistant',
      agent: e.agent ?? null,
      model: e.model ?? null,
      provider: e.provider ?? null,
      time: e.time ?? Date.now(),
      first: e.first ?? null,
      done: null,
      tok: e.tok ?? null,
      parts: [],
    });
    i = next.length - 1;
    if (next.length > MAX_MSGS) {
      next.shift();
      i--;
    }
  }
  const m = { ...next[i] };
  if (e.type === 'message') {
    m.role = e.role ?? m.role;
    m.agent = e.agent ?? m.agent;
    m.model = e.model ?? m.model;
    m.provider = e.provider ?? m.provider;
    m.time = e.time ?? m.time;
    m.first = e.first ?? m.first;
    m.done = e.done ?? null;
    if (e.tok) m.tok = e.tok; // what it spent: the stats line's, once it has ended
    if (e.error) m.error = e.error;
  } else if (e.type === 'part') {
    const pid = e.id;
    if (!pid || !e.part || typeof e.part !== 'object') return same;
    const np: WboPart = { ...e.part, id: pid };
    const k = m.parts.findIndex((p) => p.id === pid);
    m.parts = k < 0 ? [...m.parts, np] : m.parts.map((p, j) => (j === k ? np : p));
  } else {
    const pid = typeof e.part === 'string' ? e.part : '';
    if (!pid || typeof e.delta !== 'string') return same;
    const k = m.parts.findIndex((p) => p.id === pid);
    if (k < 0) m.parts = [...m.parts, { id: pid, type: pid.startsWith('r') ? 'reasoning' : 'text', text: e.delta }];
    else {
      const add = deltaPast(m.parts[k].text ?? '', e.delta, e.o);
      if (!add) return same;
      m.parts = m.parts.map((p, j) => (j === k ? { ...p, text: (p.text ?? '') + add } : p));
    }
  }
  next[i] = m;
  return { s, msgs: next };
}

// ---- what a line sent became, why one cannot write -----------------------------

export function sendWord(m: WboSend, t: WboStrings, words: (x: string) => string = (x) => x): string {
  switch (m.status) {
    case 'queued':
      return t.sentWaiting;
    case 'delivered':
      return t.delivered;
    case 'refused':
      return t.refused;
    case 'expired':
      return t.expired;
    default:
      return t.notDelivered + (m.error ? `: ${words(m.error)}` : '');
  }
}

export function sendTone(m: WboSend): 'ok' | 'danger' | null {
  return m.status === 'delivered' ? 'ok' : m.status === 'queued' ? null : 'danger';
}

export function wboWhy(s: Pick<WboSession, 'why' | 'owner'>, t: WboStrings): string {
  switch (s.why) {
    case 'not-yours':
      return t.why.notYours(s.owner?.name || t.itsPerson);
    case 'no-bridge':
      return t.why.noBridge;
    case 'remote-off':
      return t.why.remoteOff;
    case 'imp':
      return t.why.imp;
    default:
      return t.why.other;
  }
}

// ---- what OpenCode asks ----------------------------------------------------------

/** A choice being made in a card: field -> picked values, and its own words. */
export interface Choice {
  picks: Record<string, string[]>;
  others: Record<string, string>;
}
export const NO_CHOICE: Choice = { picks: {}, others: {} };

/** An option tapped: one of several toggles; the only one is taken or let go (and its own words cleared). */
export function choose(c: Choice, f: WboField, v: string): Choice {
  const cur = c.picks[f.key] ?? [];
  const next =
    f.type === 'multiselect' ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : cur[0] === v ? [] : [v];
  return {
    picks: { ...c.picks, [f.key]: next },
    others: f.type === 'multiselect' ? c.others : { ...c.others, [f.key]: '' },
  };
}

/** Its own words typed: for a one-answer question they replace the option picked. */
export function setOther(c: Choice, f: WboField, v: string): Choice {
  return {
    picks: v.trim() && f.type !== 'multiselect' ? { ...c.picks, [f.key]: [] } : c.picks,
    others: { ...c.others, [f.key]: v },
  };
}

export function valueOf(c: Choice, f: WboField): unknown {
  const pk = c.picks[f.key] ?? [];
  const ot = (c.others[f.key] ?? '').trim();
  if (f.type === 'multiselect') return ot ? [...pk, ot] : pk;
  if (f.type === 'number' || f.type === 'integer') return ot ? Number(ot) : undefined;
  if (f.type === 'boolean') return pk[0] === 'true' ? true : pk[0] === 'false' ? false : undefined;
  return ot || pk[0];
}

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '');

/** Every required question has an answer, and at least one has. */
export function isReady(a: WboAsk, c: Choice): boolean {
  const fs = a.fields ?? [];
  return fs.every((f) => !f.required || filled(valueOf(c, f))) && fs.some((f) => filled(valueOf(c, f)));
}

/** The answer sent: the fields answered. */
export function answerOf(a: WboAsk, c: Choice): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of a.fields ?? []) {
    const v = valueOf(c, f);
    if (filled(v)) out[f.key] = v;
  }
  return out;
}

/** A boolean question's two options, when OpenCode gave none. */
export function optionsOf(f: WboField, yes = 'Yes', no = 'No'): WboField['options'] {
  if (f.options.length || f.type !== 'boolean') return f.options;
  return [
    { value: 'true', label: yes, description: '' },
    { value: 'false', label: no, description: '' },
  ];
}

export function askState(a: WboAsk, t: WboStrings): string {
  switch (a.status) {
    case 'pending':
      return a.local ? t.waitingAnAnswer : t.waitingAnswer;
    case 'answering':
      return t.sendingAnswer;
    case 'answered':
    case 'replied':
      return a.via === 'chat' ? t.answeredChat : a.local ? t.answered : t.answeredComputer;
    default:
      return t.noLonger;
  }
}

/** What was answered to one question (the options' labels), or chosen while on its way. */
export function shownAnswer(a: WboAsk, f: WboField): string {
  const src = a.status === 'answering' ? a.chosen?.answer : a.answer;
  const v = src?.[f.key];
  if (v === undefined || v === null || v === '') return '';
  const label = (x: string) => f.options.find((o) => o.value === x)?.label ?? x;
  return Array.isArray(v) ? v.map((x) => label(String(x))).join(', ') : label(String(v));
}

export function decisionWord(a: WboAsk, t: WboStrings): string {
  const d = a.status === 'answering' ? a.chosen?.decision : a.decision;
  return d === 'once' ? t.allowedOnce : d === 'always' ? t.alwaysAllowed : d === 'reject' ? t.rejected : '';
}
