/**
 * A session's column on the phone: the same answer the web's right-hand column draws
 * (backend/wb_panel.py, GET /api/wbo/sessions/{sid}/panel) - the model and its window, what it spent, the
 * computer, the todo list, the files it changed, what it is waiting for, the tools it used.
 *
 * The sections are the web's (frontend/src/app/rooms/session-panel.ts) and so are the rules: a section with
 * nothing in it is not drawn at all, the person's fold of it is kept on the server (/api/me/side `panel`), and
 * the words are the web's Turkish wherever it has the same line (lib/wboStrings.ts).
 */
import type { PanelFile, PanelTodo, PanelTool, WboPanel } from '../api/types';
import type { WboStrings } from './wboStrings';

export type PanelSectionId = 'model' | 'computer' | 'todos' | 'files' | 'pending' | 'tools';

export interface PanelSection {
  id: PanelSectionId;
  label: string;
  /** What the head says after the label ("3/7", "12"), or null. */
  count: string | null;
  /** The head is drawn in the warning tone (a question waiting, a full window). */
  warn: boolean;
}

/** The sections that have something to say, in the order the column shows them. */
export function panelSections(p: WboPanel | null, t: WboStrings): PanelSection[] {
  if (!p) return [];
  const out: PanelSection[] = [
    { id: 'model', label: t.model, count: stateWord(p, t), warn: p.session.status === 'error' },
  ];
  if (p.session.computer) out.push({ id: 'computer', label: t.computer, count: null, warn: false });
  if (p.todos?.items.length) {
    out.push({ id: 'todos', label: t.todos, count: `${p.todos.done}/${p.todos.total}`, warn: false });
  }
  if (p.files?.items.length) {
    out.push({ id: 'files', label: t.changedFiles, count: String(p.files.items.length), warn: false });
  }
  if (p.pending?.length) {
    out.push({ id: 'pending', label: t.waiting, count: String(p.pending.length), warn: true });
  }
  if (p.tools?.items.length) {
    out.push({
      id: 'tools',
      label: t.tools,
      count: String(p.tools.items.reduce((n, r) => n + r.count, 0)),
      warn: false,
    });
  }
  return out;
}

/** What the session is doing, in the words the header uses. */
export function stateWord(p: WboPanel, t: WboStrings): string {
  const s = p.session;
  if (s.status === 'waiting') return t.waitingAnAnswer;
  if (s.status === 'busy' || s.status === 'retry') return t.working;
  if (s.status === 'error') return t.errorWord;
  return t.idle;
}

/** How many things wait for the person: the badge the sheet's button carries. */
export function panelWaiting(p: WboPanel | null): number {
  return p?.pending?.length ?? 0;
}

/** A path as the column shows it: the last two parts, the whole one for the long press. */
export function shortPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join('/')}`;
}

/** A file's line counts, when the run reported them ("+12 −3"), else ''. */
export function diffText(f: PanelFile): string {
  if (f.additions == null || f.deletions == null) return '';
  return `+${f.additions} −${f.deletions}`;
}

/** A row's own line: "3× · +12 −3 · 2 min ago", what of it is known. */
export function fileLine(f: PanelFile, when: string): string {
  return [f.count > 1 ? `${f.count}×` : '', diffText(f), when].filter(Boolean).join(' · ');
}

/** A tool's row: its name, its server, how often, its failures. */
export function toolLine(r: PanelTool): string {
  const bits = [r.server ? `${r.server} · ${r.name}` : r.name];
  if (r.errors) bits.push(`${r.errors} failed`);
  return bits.join(' · ');
}

export const TODO_NEXT: Record<PanelTodo['status'], PanelTodo['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
  cancelled: 'pending',
};
