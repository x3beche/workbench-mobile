/** The tools an answer ran (backend/ccgen.py steps), as the chat shows them. */
import type { Step } from '../api/types';

/** The step's sentence with its slots filled: "Reading {name}" -> "Reading Sensor board". */
export function stepLabel(s: Step): string {
  const vars = s.vars ?? {};
  const said = (s.say || '').replace(/\{(\w+)\}/g, (_m, k: string) =>
    vars[k] != null && vars[k] !== '' ? String(vars[k]) : '…',
  );
  return said.trim() || s.tool.replace(/_/g, ' ');
}

export type StepState = 'running' | 'done' | 'failed' | 'stopped';

export function stepState(s: Step): StepState {
  if (s.status === 'running' || s.status === 'ask') return 'running';
  if (s.status === 'error' || s.status === 'denied') return 'failed';
  if (s.status === 'stopped' || s.status === 'interrupted') return 'stopped';
  return 'done';
}

/** What a step left to read when it is opened: its summary, or why it did not run. */
export function stepDetail(s: Step): string {
  if (s.status === 'error') return s.error || 'It failed.';
  if (s.status === 'denied') return 'Not run: it was not allowed.';
  if (s.status === 'ask') return 'Waiting to be allowed on the web app.';
  if (s.status === 'stopped') return 'Not finished: the answer was stopped.';
  if (s.status === 'interrupted') return 'Not finished: the server restarted.';
  return s.summary || '';
}

export type Chunk = { kind: 'text'; text: string } | { kind: 'steps'; steps: Step[] };

/**
 * An answer cut at its steps, as backend/cc_chat.py `_segments` cuts it: the
 * text before, the steps that ran there, and so on. Steps at the same place
 * go together; empty text pieces are left out.
 */
export function chunks(text: string, steps: Step[] | undefined): Chunk[] {
  if (!steps?.length) return text ? [{ kind: 'text', text }] : [];
  const out: Chunk[] = [];
  let at = 0;
  const sorted = [...steps].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  for (const s of sorted) {
    const pos = Math.min(Math.max(s.pos ?? 0, at), text.length);
    const said = text.slice(at, pos);
    if (said.trim()) out.push({ kind: 'text', text: said });
    const last = out[out.length - 1];
    if (last?.kind === 'steps' && !said.trim()) last.steps.push(s);
    else out.push({ kind: 'steps', steps: [s] });
    at = pos;
  }
  const rest = text.slice(at);
  if (rest.trim()) out.push({ kind: 'text', text: rest });
  return out;
}
