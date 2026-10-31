/**
 * The folder under a session's name (lib/wboPanel.ts `titleDir`): read from its start, and a deeper one gives
 * way in the middle - the project and the folder the session is in, as the web's title bar writes it
 * (redline-studio f80e4af, opencode-sessions.ts `dirShort`).
 */
import { wboStrings } from '../wboStrings';
import { ctxWhy, panelSections, recentTitle, titleDir } from '../wboPanel';
import type { WboPanel } from '../../api/types';

describe('titleDir', () => {
  it('leaves a short folder as it is', () => {
    expect(titleDir('~/sensor')).toBe('~/sensor');
    expect(titleDir('~/projects/sensor-board')).toBe('~/projects/sensor-board');
    expect(titleDir('')).toBe('');
    expect(titleDir('~')).toBe('~');
    expect(titleDir('~/sensor/')).toBe('~/sensor');
  });

  it('gives way in the middle and keeps the project and the folder, from the start', () => {
    expect(titleDir('~/projects/redline-studio/frontend/src/app')).toBe('~/…/redline-studio/app');
    expect(titleDir('/home/x3/projects/redline-studio/rooms')).toBe('~/…/redline-studio/rooms');
    expect(titleDir('/var/lib/workbench/build/output')).toBe('…/build/output');
  });

  it('says a home of one name as ~', () => {
    expect(titleDir('/home/x3')).toBe('~');
  });
});

describe('recentTitle', () => {
  const en = wboStrings('en');
  const call = { tool: 'shell', cat: 'shell', title: 'npm test', status: 'completed', start: 1, end: 2, part: 'm' };

  it('says what ran, and the calls a chained one carried', () => {
    expect(recentTitle(call, en)).toBe('npm test');
    expect(recentTitle({ ...call, more: 2 }, en)).toBe('npm test (2 commands)');
  });

  it('falls back to the tool when it has no title', () => {
    expect(recentTitle({ ...call, title: '' }, en)).toBe('shell');
  });
});


/** The files section holds two kinds of row; the window row is drawn even when it cannot be used. */
const base = {
  session: { id: 's1', title: 'T', status: 'idle', asking: false, since: null, model: null, context: null,
             context_limit: null, context_options: null, computer: { connected: true, version: '0.3.6' } },
  series: { context: [], spans: [], recent: [], rate: null, diff_series: null },
  todos: { items: [], done: 0, total: 0, at: null }, tools: { items: [], more: 0 }, pending: [],
  tokens: { input: 0, output: 0, cache_read: null, cache_write: null, cost: 0, source: 'session', messages: 0 },
  files: { items: [], more: 0, temp: { items: [], more: 0 } },
  messages: 0, complete: true, at: 0, may_answer: true, why: '',
} as unknown as WboPanel;
const en = wboStrings('en');

describe('the files section', () => {
  it('is drawn for a session with only scratch files, and its head says no number', () => {
    const p = { ...base, files: { items: [], more: 0, temp: { items: [{ path: '/tmp/x.md' }], more: 0 } } } as unknown as WboPanel;
    const sec = panelSections(p, en).find((s) => s.id === 'files');
    expect(sec).toBeTruthy();
    expect(sec!.count).toBeNull();          // "0" would only be the changed files' own count
  });

  it('is not drawn when it holds nothing at all', () => {
    expect(panelSections(base, en).some((s) => s.id === 'files')).toBe(false);
  });
});

describe('ctxWhy', () => {
  const withCtx = (can: boolean, connected: boolean) => ({
    ...base,
    session: { ...(base as any).session, computer: { connected, version: '0.3.2' },
               context_options: { limit: null, max: 512_000, steps: [64_000], min: 16_000, can } },
  }) as unknown as WboPanel;

  it('says the run there is too old, or that the computer is away', () => {
    expect(ctxWhy(withCtx(false, true), en)).toBe('restart to change');
    expect(ctxWhy(withCtx(false, false), en)).toBe('that computer is not connected');
  });

  it('says nothing when the row may be used', () => {
    expect(ctxWhy(withCtx(true, true), en)).toBe('');
  });
});
