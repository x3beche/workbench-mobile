import type { ChatMessage } from '../../api/types';
import { applyEvent, applyPiece, fit, type ConversationView } from '../answer';

const msg = (id: string, role: 'user' | 'assistant', content: string): ChatMessage => ({
  id,
  role,
  content,
  at: '2026-10-14T10:00:00Z',
});

const base = (): ConversationView => ({
  title: 'New conversation',
  messages: [msg('1', 'user', 'hi'), msg('2', 'assistant', 'hello')],
  writing: null,
  stale: false,
});

describe('fit', () => {
  it('appends a piece that goes at the end, or has no place', () => {
    expect(fit('abc', 'de', 3)).toBe('abcde');
    expect(fit('abc', 'de')).toBe('abcde');
  });
  it('skips what it has already', () => {
    expect(fit('abcde', 'cdef', 2)).toBe('abcdef');
    expect(fit('abcde', 'b', 1)).toBe('abcde');
  });
  it('gives null when pieces before it never came', () => {
    expect(fit('ab', 'z', 5)).toBeNull();
  });
});

describe('applyEvent', () => {
  it('user: keeps the first `keep` lines, adds the line, starts writing', () => {
    const v = applyEvent(base(), { type: 'user', keep: 1, gen: 'g1', message: msg('3', 'user', 'edited') });
    expect(v.messages.map((m) => m.id)).toEqual(['1', '3']);
    expect(v.writing).toEqual({ gen: 'g1', text: '', thinking: '', error: null, steps: [] });
  });

  it('text and thinking pieces build the answer', () => {
    let v = applyEvent(base(), { type: 'user', keep: 2, gen: 'g1', message: msg('3', 'user', 'q') });
    v = applyEvent(v, { type: 'thinking', text: 'hmm', at: 0 });
    v = applyEvent(v, { type: 'text', text: 'Hel', at: 0 });
    v = applyEvent(v, { type: 'text', text: 'lo', at: 3 });
    v = applyEvent(v, { type: 'text', text: 'llo!', at: 2 });
    expect(v.writing).toMatchObject({ text: 'Hello!', thinking: 'hmm' });
    expect(v.stale).toBe(false);
  });

  it('a gap marks the view stale', () => {
    let v = applyEvent(base(), { type: 'start', gen: 'g1', text: 'ab' });
    v = applyEvent(v, { type: 'text', text: 'z', at: 10 });
    expect(v.stale).toBe(true);
    expect(v.writing?.text).toBe('ab');
  });

  it('ignores pieces of another answer', () => {
    let v = applyEvent(base(), { type: 'start', gen: 'g1' });
    v = applyEvent(v, { type: 'text', gen: 'g2', text: 'other' });
    expect(v.writing?.text).toBe('');
  });

  it('hello takes the answer under way, or notices one that ended', () => {
    const v = applyEvent(base(), { type: 'hello', live: [{ gen: 'g1', text: 'so far', thinking: 't' }] });
    expect(v.writing).toEqual({ gen: 'g1', text: 'so far', thinking: 't', error: null, steps: [] });
    expect(applyEvent(base(), { type: 'hello', live: [] })).toEqual(base());
    const ended = applyEvent(v, { type: 'hello', live: [] });
    expect(ended).toMatchObject({ writing: null, stale: true });
  });

  it('start does not throw away text already shown for the same answer', () => {
    let v = applyEvent(base(), { type: 'start', gen: 'g1', text: 'abc' });
    v = applyEvent(v, { type: 'start', gen: 'g1', text: 'a' });
    expect(v.writing?.text).toBe('abc');
  });

  it('error keeps what was written and says why', () => {
    let v = applyEvent(base(), { type: 'start', gen: 'g1', text: 'part' });
    v = applyEvent(v, { type: 'error', error: 'rate limited' });
    expect(v.writing).toMatchObject({ text: 'part', error: 'rate limited' });
    expect(applyEvent(base(), { type: 'error' }).writing?.error).toBe('The answer failed.');
  });

  it('done puts the answer in the conversation; end after it changes nothing', () => {
    let v = applyEvent(base(), { type: 'start', gen: 'g1', text: 'x' });
    v = applyEvent(v, { type: 'done', message: msg('4', 'assistant', 'x') });
    expect(v.messages.map((m) => m.id)).toEqual(['1', '2', '4']);
    expect(v.writing).toBeNull();
    expect(applyEvent(v, { type: 'end', gen: 'g1' })).toBe(v);
  });

  it('done without its line, or end without done, asks for a reload', () => {
    const w = applyEvent(base(), { type: 'start', gen: 'g1' });
    expect(applyEvent(w, { type: 'done', message: null }).stale).toBe(true);
    expect(applyEvent(w, { type: 'end' })).toMatchObject({ writing: null, stale: true });
  });

  it('title renames; unknown events change nothing', () => {
    expect(applyEvent(base(), { type: 'title', title: 'Gear ratios' }).title).toBe('Gear ratios');
    const v = base();
    expect(applyEvent(v, { type: 'title' })).toBe(v);
    expect(applyEvent(v, { type: 'queue' })).toBe(v);
    expect(applyEvent(v, { type: 'steps' })).toBe(v);
  });

  it('steps: the whole list of tools run so far replaces the last one, for this answer only', () => {
    let v = applyEvent(base(), { type: 'start', gen: 'g1' });
    const running = { id: 's1', tool: 'read_board', status: 'running', pos: 0 };
    v = applyEvent(v, { type: 'steps', gen: 'g1', steps: [running] });
    expect(v.writing?.steps).toEqual([running]);
    v = applyEvent(v, { type: 'steps', gen: 'g1', steps: [{ ...running, status: 'done' }] });
    expect(v.writing?.steps.map((x) => x.status)).toEqual(['done']);
    expect(applyEvent(v, { type: 'steps', gen: 'g2', steps: [] })).toBe(v);
  });

  it('hello and start carry the steps of an answer under way', () => {
    const steps = [{ id: 's1', tool: 't', status: 'running' }];
    expect(applyEvent(base(), { type: 'hello', live: [{ gen: 'g1', steps }] }).writing?.steps).toEqual(steps);
    expect(applyEvent(base(), { type: 'start', gen: 'g1', steps }).writing?.steps).toEqual(steps);
  });
});

describe('applyPiece (the S2 lane)', () => {
  const writing = (): ConversationView => ({
    ...base(),
    writing: { gen: 'g1', text: 'Hello', thinking: '', error: null, steps: [] },
  });

  it('takes a piece of the answer being written where it fits, whichever stream brought it first', () => {
    let v = applyPiece(writing(), { type: 'text', gen: 'g1', text: ' wor', at: 5 });
    expect(v.writing?.text).toBe('Hello wor');
    // The answer's own stream brings the same piece later: nothing changes.
    v = applyEvent(v, { type: 'text', gen: 'g1', text: ' wor', at: 5 });
    expect(v.writing?.text).toBe('Hello wor');
    v = applyEvent(v, { type: 'text', gen: 'g1', text: 'ld', at: 9 });
    // ...and S2's copy of that one after it: the same.
    expect(applyPiece(v, { type: 'text', gen: 'g1', text: 'ld', at: 9 })).toBe(v);
    expect(v.writing?.text).toBe('Hello world');
  });

  it('leaves alone a piece it cannot place, of another answer, or with nothing being written', () => {
    const w = writing();
    expect(applyPiece(w, { type: 'text', gen: 'g1', text: 'x', at: 40 })).toBe(w);
    expect(applyPiece(w, { type: 'text', gen: 'g2', text: 'x', at: 5 })).toBe(w);
    const idle = base();
    expect(applyPiece(idle, { type: 'text', gen: 'g1', text: 'x', at: 0 })).toBe(idle);
    expect(applyPiece(w, { type: 'text', gen: 'g1', text: 'x', at: 40 }).stale).toBe(false);
  });

  it('takes the steps and the thinking too', () => {
    const v = applyPiece(writing(), { type: 'steps', gen: 'g1', steps: [{ id: 's1', tool: 't', status: 'running' }] as never });
    expect(v.writing?.steps).toHaveLength(1);
    expect(applyPiece(v, { type: 'thinking', gen: 'g1', text: 'hm', at: 0 }).writing?.thinking).toBe('hm');
  });
});
