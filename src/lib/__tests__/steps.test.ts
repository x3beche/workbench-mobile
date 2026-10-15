import type { Step } from '../../api/types';
import { chunks, stepDetail, stepLabel, stepState } from '../steps';

const step = (id: string, pos: number, extra: Partial<Step> = {}): Step => ({
  id,
  tool: 'read_board',
  status: 'done',
  pos,
  ...extra,
});

describe('stepLabel', () => {
  it("fills the slots from the step's values", () => {
    expect(stepLabel(step('a', 0, { say: 'Reading {name} ({n} parts)', vars: { name: 'Sensor board', n: 42 } }))).toBe(
      'Reading Sensor board (42 parts)',
    );
  });
  it('shows an ellipsis for a value not there, and the tool name when there is no sentence', () => {
    expect(stepLabel(step('a', 0, { say: 'Looking up {query}' }))).toBe('Looking up …');
    expect(stepLabel(step('a', 0))).toBe('read board');
  });
});

describe('stepState and stepDetail', () => {
  it.each([
    ['running', 'running'],
    ['ask', 'running'],
    ['done', 'done'],
    ['error', 'failed'],
    ['denied', 'failed'],
    ['stopped', 'stopped'],
    ['interrupted', 'stopped'],
  ])('%s -> %s', (status, want) => {
    expect(stepState(step('a', 0, { status }))).toBe(want);
  });
  it('tells why a step did not finish, or what it found', () => {
    expect(stepDetail(step('a', 0, { status: 'error', error: 'no such board' }))).toBe('no such board');
    expect(stepDetail(step('a', 0, { summary: '42 parts' }))).toBe('42 parts');
    expect(stepDetail(step('a', 0))).toBe('');
  });
});

describe('chunks', () => {
  it('is the text alone without steps', () => {
    expect(chunks('Hello', undefined)).toEqual([{ kind: 'text', text: 'Hello' }]);
    expect(chunks('', [])).toEqual([]);
  });

  it('cuts the text where the steps ran, steps at one place together', () => {
    const text = 'First part. Second part.';
    const got = chunks(text, [step('b', 12), step('a', 0), step('c', 12)]);
    expect(got).toEqual([
      { kind: 'steps', steps: [step('a', 0)] },
      { kind: 'text', text: 'First part. ' },
      { kind: 'steps', steps: [step('b', 12), step('c', 12)] },
      { kind: 'text', text: 'Second part.' },
    ]);
  });

  it('keeps a step past the end of the text (still being written) at the end', () => {
    expect(chunks('So far', [step('a', 99)])).toEqual([
      { kind: 'text', text: 'So far' },
      { kind: 'steps', steps: [step('a', 99)] },
    ]);
  });
});
