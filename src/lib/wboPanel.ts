/**
 * A session's column on the phone: the same answer the web's right-hand column draws
 * (backend/wb_panel.py, GET /api/wbo/sessions/{sid}/panel) - what it waits for, its todo list, the files it
 * changed, the model and its window, the computer it runs on, the tools it used - in that order, the things
 * that need a person first.
 *
 * The sections are the web's (frontend/src/app/rooms/session-panel.ts) and so are the rules: a section with
 * nothing in it is not drawn at all, the person's fold of it is kept on the server (/api/me/side `panel`),
 * the head's number sits at the same place on every row, and the words are the web's Turkish wherever it has
 * the same line (lib/wboStrings.ts).
 */
import type { PanelFile, PanelTool, WboPanel } from '../api/types';
import type { WboStrings } from './wboStrings';

export type PanelSectionId = 'pending' | 'todos' | 'files' | 'model' | 'computer' | 'tools' | 'flow';

export interface PanelSection {
  id: PanelSectionId;
  label: string;
  /** What the head says after the label: "1", "3/7", "shell 120 · read 88 · edit 41 · +6". */
  count: string | null;
  /** The head is drawn in the warning tone (a question waiting). */
  warn: boolean;
}

/** The tools a column shows before "N more" - in the flow's own list, not a section of its own. */
export const TOOLS_SHOWN = 5;
/** The window is nearly full at this share of it - and all but full at the second. */
export const CTX_WARN = 80;
export const CTX_DANGER = 95;

/** The sections that have something to say, in the order a person reads them - the same order the web's
 *  column has: the model and its window first (it is the thing a session is), then what the run is doing, then
 *  the files it changed. The question waiting and the computer are not sections: the question is one line above
 *  them (its card is in the conversation, where it is answered), and the computer is the dim line at the foot. */
export function panelSections(p: WboPanel | null, t: WboStrings): PanelSection[] {
  if (!p) return [];
  const out: PanelSection[] = [];
  out.push({ id: 'model', label: t.model, count: null, warn: p.session.status === 'error' });
  if (p.series?.spans?.length || p.todos?.items.length) {
    out.push({ id: 'flow', label: t.now, count: null, warn: false });
  }
  if (p.files?.items.length) {
    // the work's own files; the scratch ones are folded at the foot, and the head counts only the work
    const counted = p.files.items.some((r) => r.additions != null);
    const add = p.files.items.reduce((n, r) => n + (r.additions ?? 0), 0);
    const del = p.files.items.reduce((n, r) => n + (r.deletions ?? 0), 0);
    out.push({
      id: 'files',
      label: t.changedFiles,
      count: counted ? `+${add} −${del}` : String(p.files.items.length),
      warn: false,
    });
  }
  return out;
}

/** "Waiting: 1 permission" - the one line above the sections, when something is waiting. */
export function waitingLine(p: WboPanel | null, t: WboStrings): string {
  const rows = p?.pending ?? [];
  if (!rows.length) return '';
  const perm = rows.filter((a) => a.kind === 'permission').length;
  const ask = rows.length - perm;
  const bits: string[] = [];
  if (perm) bits.push(t.permissions(perm));
  if (ask) bits.push(t.questions(ask));
  return `${t.waiting}: ${bits.join(' · ')}`;
}

/** "shell 120 · read 88 · edit 41 · +6" - what a folded tools head says instead of a bare number. */
export function toolSummary(rows: PanelTool[], errors: number): string {
  const top = rows
    .slice(0, 3)
    .map((r) => `${r.name} ${r.count}`)
    .join(' · ');
  const rest = rows.length - 3;
  return `${errors ? `⚠${errors} ` : ''}${top}${rest > 0 ? ` · +${rest}` : ''}`;
}

/** What the session is doing, for a reader - the column's own head says it on the web. */
export function stateWord(p: WboPanel, t: WboStrings): string {
  const s = p.session;
  if (s.status === 'waiting') return t.waitingAnAnswer;
  if (s.status === 'busy' || s.status === 'retry') return t.working;
  if (s.status === 'error') return t.errorWord;
  return t.idle;
}

/** "2:41" while it works: minutes and seconds, unbounded minutes. */
export function workedFor(since: number | null, now: number): string {
  if (!since) return '';
  const s = Math.max(0, Math.round((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** How many things wait for the person: the badge the sheet's button carries. */
export function panelWaiting(p: WboPanel | null): number {
  return p?.pending?.length ?? 0;
}

/** A path's last part (the file) and the folder it is in, shown under it. */
export function baseName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function dirName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

/** "7 edits" - how often the session touched it (and nothing when it touched it once). */
export function editsLabel(f: PanelFile, t: WboStrings): string {
  return f.count > 1 ? t.editsTimes(f.count) : '';
}

/** A file's line counts, when the run reported them ("+12 −3"), else ''. */
export function diffText(f: PanelFile): string {
  if (f.additions == null || f.deletions == null) return '';
  return `+${f.additions} −${f.deletions}`;
}

/** A row's own line: "7 edits · 21 min ago" - the counts are beside the name now (the web's second round),
 *  so they are not said twice. */
export function fileLine(f: PanelFile, when: string, t: WboStrings): string {
  return [editsLabel(f, t), when].filter(Boolean).join(' · ');
}

/** A tool's row: its server, how often, its failures. */
export function toolLine(r: PanelTool, t: WboStrings): string {
  const bits = [r.server ? `${r.server} · ${r.name}` : r.name, t.callsTimes(r.count)];
  if (r.errors) bits.push(t.failedTimes(r.errors));
  return bits.join(' · ');
}

/** The window, one line: "453k / 1M · 45%" - short, as the web's head line is. */
export function ctxLine(p: WboPanel): string {
  const c = p.session.context;
  if (!c) return '';
  return `${shortK(c.used)} / ${c.limit ? shortK(c.limit) : '?'} · ${c.pct != null ? `${c.pct}%` : '–'}`;
}

/** 54_802 as "54.8k", 1_000_000 as "1M": the window's own line, read at a glance rather than to the token
 *  (the web's shortNum, rooms/claude-sessions.ts). The counts under it keep `kfmt`'s two decimals. */
export function shortK(n: number): string {
  if (!(n > 0)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** The tone of the window's share: '', 'warn' over 80%, 'bad' over 95%. */
export function ctxTone(p: WboPanel): '' | 'warn' | 'bad' {
  const pct = p.session.context?.pct;
  if (pct == null) return '';
  return pct >= CTX_DANGER ? 'bad' : pct >= CTX_WARN ? 'warn' : '';
}

/** What the tooltip carries on the web: the exact numbers, what is left, and that OpenCode compacts a session
 *  by itself when the window is nearly full (its own threshold is not published, so none is named). */
export function ctxTip(p: WboPanel, t: WboStrings): string {
  const c = p.session.context;
  if (!c) return '';
  const rows = [`${c.used.toLocaleString('en-US')} / ${c.limit ? c.limit.toLocaleString('en-US') : '?'} ${t.ofItsWindow}`];
  if (c.pct != null) rows.push(`${c.pct}%`);
  if (c.limit) rows.push(`${(c.limit - c.used > 0 ? c.limit - c.used : 0).toLocaleString('en-US')} ${t.leftOfWindow}`);
  if (c.pct != null && c.pct >= CTX_WARN) rows.push(t.compactsItself);
  if (c.model) rows.push(c.model);
  return rows.join('\n');
}

/** 10.05k / 3.4M / 1.05B - the app's own number words. */
export function kfmt(n: number): string {
  if (n >= 999.95e6) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(2)}k`;
  if (n >= 1000) return n.toLocaleString('en-US');
  return String(Math.round(n));
}
