/** The OpenCode sessions without drawing them: words and dots, the drawer's list, turns, live records, sends, asks. */
import type { WboAsk, WboDetail, WboField, WboMsg, WboSend, WboSession } from '../../api/types';
import {
  answerOf,
  applyWbo,
  askState,
  buildTurns,
  choose,
  decisionWord,
  groupDot,
  isReady,
  lastModel,
  looseAsks,
  NO_CHOICE,
  pendingSends,
  putAsk,
  sendTone,
  sendWord,
  setOther,
  shownAnswer,
  shownWbo,
  toStep,
  wboDot,
  wboWhy,
  wboWord,
} from '../wbo';
import { wboStrings } from '../wboStrings';
import { stepLabel } from '../steps';

const en = wboStrings('en');
const tr = wboStrings('tr');
const NOW = 1_800_000_000_000;

const bridge = {
  id: 'b1',
  connected: true,
  remote: true,
  host: 'h',
  platform: 'linux',
  version: '0.2.0',
  opencode: '2.1.2',
  cwd: '~/x',
  model: '',
  seen: null,
  started: null,
};
const session = (over: Partial<WboSession> = {}): WboSession => ({
  session_id: 'ses_aaaaaaaa',
  title: 'Rail',
  name: 'Rail',
  status: 'idle',
  directory: '~/x',
  computer: 'ada-laptop',
  updated: NOW - 60_000,
  seen: null,
  created: null,
  parent: null,
  tokens: { input: 0, output: 0 },
  mine: true,
  owner: { id: 'u1', name: 'Ada' },
  bridge,
  may_send: true,
  why: '',
  ...over,
});
const detail = (over: Partial<WboDetail> = {}): WboDetail => ({
  ...session(),
  messages: [],
  truncated: false,
  sends: [],
  asks: [],
  ...over,
});
const msg = (id: string, role: 'user' | 'assistant', over: Partial<WboMsg> = {}): WboMsg => ({
  id,
  role,
  time: 1000,
  done: 2000,
  parts: [],
  ...over,
});
const field = (over: Partial<WboField> = {}): WboField => ({
  key: 'q0',
  type: 'string',
  title: 'Which?',
  description: '',
  custom: false,
  required: true,
  options: [
    { value: 'a', label: 'Alpha', description: 'first' },
    { value: 'b', label: 'Beta', description: '' },
  ],
  ...over,
});
const ask = (over: Partial<WboAsk> = {}): WboAsk => ({
  id: 'frm_aaaaaaaa',
  kind: 'form',
  fields: [field()],
  status: 'pending',
  at: 1,
  settled_at: null,
  ...over,
});

describe('words and dots', () => {
  it('says what a run does, and its dot', () => {
    expect(wboWord(session(), en)).toBe('ready');
    expect(wboWord(session({ status: 'busy' }), en)).toBe('working');
    expect(wboWord(session({ status: 'waiting' }), en)).toBe('waiting for your answer');
    expect(wboWord(session({ status: 'waiting' }), tr)).toBe('cevabınızı bekliyor');
    expect(wboWord(session({ bridge: null, status: 'ended' }), en)).toBe('not connected');
    expect(wboDot(session({ status: 'busy' }))).toBe('running');
    expect(wboDot(session({ status: 'waiting' }))).toBe('retry');
    expect(wboDot(session())).toBe('idle');
    expect(wboDot(session({ bridge: null }))).toBeNull();
    expect(groupDot([null, 'idle', 'retry'])).toBe('retry');
    expect(groupDot(['idle', 'running'])).toBe('running');
    expect(groupDot([null])).toBeNull();
  });

  it('says why one cannot write, in the web words', () => {
    expect(wboWhy({ why: 'not-yours', owner: { id: 'u2', name: 'Bo' } }, en)).toBe(
      'Only Bo can write to this session; you can read it.',
    );
    expect(wboWhy({ why: 'no-bridge', owner: { id: null, name: '' } }, en)).toContain('wb-opencode');
    expect(wboWhy({ why: 'remote-off', owner: { id: null, name: '' } }, tr)).toBe(
      'wb-opencode bağlı, ancak o bilgisayarda uzaktan mesajlar kapalı.',
    );
  });

  it('lists the live ones, the last day, the open one and the pinned ones; a search narrows them', () => {
    const rows = [
      session(),
      session({ session_id: 'ses_old11111', name: 'Old', bridge: null, updated: NOW - 3 * 86_400_000 }),
      session({ session_id: 'ses_pin22222', name: 'Pinned', bridge: null, updated: NOW - 9 * 86_400_000 }),
    ];
    const pinned = (id: string) => id === 'ses_pin22222';
    expect(shownWbo(rows, '', null, pinned, NOW).map((s) => s.name)).toEqual(['Rail', 'Pinned']);
    expect(shownWbo(rows, '', 'ses_old11111', undefined, NOW).map((s) => s.name)).toEqual(['Rail', 'Old']);
    expect(shownWbo(rows, 'laptop', null, pinned, NOW)).toHaveLength(2);
    expect(shownWbo(rows, 'zzz', null, pinned, NOW)).toHaveLength(0);
  });
});

describe('the conversation', () => {
  it('draws a run of steps as one answer: thinking, words, tool calls as step rows, an ask as its card', () => {
    const msgs = [
      msg('msg_u1', 'user', { parts: [{ id: 't0', type: 'text', text: 'fix it' }] }),
      msg('msg_a1', 'assistant', {
        model: 'deepseek/deepseek-v4',
        time: 1000,
        done: 3000,
        parts: [
          { id: 'r0', type: 'reasoning', text: 'hmm' },
          {
            id: 'call_1',
            type: 'tool',
            tool: 'bash',
            status: 'completed',
            title: 'npm {test}',
            output: 'ok',
            start: 1,
            end: 51,
          },
          { id: 'call_2', type: 'tool', tool: 'read', status: 'error', error: 'gone' },
        ],
      }),
      msg('msg_a2', 'assistant', {
        time: 3000,
        done: null,
        parts: [
          { id: 'call_q', type: 'tool', tool: 'question' },
          { id: 't0', type: 'text', text: 'So' },
        ],
      }),
    ];
    const turns = buildTurns(msgs, [ask({ part: 'call_q' })]);
    expect(turns.map((x) => x.kind)).toEqual(['user', 'assistant']);
    const a = turns[1];
    if (a.kind !== 'assistant') throw new Error('an answer');
    expect(a.items.map((x) => x.t)).toEqual(['think', 'steps', 'ask', 'text']);
    expect(a.live).toBe(true);
    expect(a.writing).toBe(true);
    expect(a.model).toBe('deepseek/deepseek-v4');
    const steps = a.items[1];
    if (steps.t !== 'steps') throw new Error('steps');
    expect(steps.steps.map((x) => x.status)).toEqual(['done', 'error']);
    expect(stepLabel(steps.steps[0])).toBe('bash · npm {test}');
    expect(steps.steps[0].ms).toBe(50);
    expect(lastModel(msgs)).toBe('deepseek/deepseek-v4');
  });

  it('keeps a permission its step row beside its card', () => {
    const turns = buildTurns(
      [msg('msg_a1', 'assistant', { parts: [{ id: 'call_p', type: 'tool', tool: 'bash', status: 'running' }] })],
      [ask({ id: 'per_aaaaaaaa', kind: 'permission', part: 'call_p', action: 'bash' })],
    );
    const a = turns[0];
    if (a.kind !== 'assistant') throw new Error('an answer');
    expect(a.items.map((x) => x.t)).toEqual(['steps', 'ask']);
    expect(toStep({ id: 'x', type: 'tool', status: 'running' }).status).toBe('running');
  });

  it('shows lines on their way and recent failures until the conversation has them', () => {
    const now = 1_000_000;
    const sends: WboSend[] = [
      {
        id: '1',
        text: 'a',
        by: {},
        status: 'queued',
        error: '',
        at: now - 5000,
        updated: null,
        delivered_at: null,
        inbox: null,
      },
      {
        id: '2',
        text: 'b',
        by: {},
        status: 'delivered',
        error: '',
        at: now - 30,
        updated: null,
        delivered_at: now - 20,
        inbox: 'msg_in',
      },
      {
        id: '3',
        text: 'c',
        by: {},
        status: 'delivered',
        error: '',
        at: now - 30,
        updated: null,
        delivered_at: now - 20,
        inbox: 'msg_have',
      },
      {
        id: '4',
        text: 'd',
        by: {},
        status: 'failed',
        error: 'x',
        at: now - 60,
        updated: null,
        delivered_at: null,
        inbox: null,
      },
      {
        id: '5',
        text: 'e',
        by: {},
        status: 'expired',
        error: '',
        at: now - 9000,
        updated: null,
        delivered_at: null,
        inbox: null,
      },
    ];
    expect(pendingSends(sends, [msg('msg_have', 'user')], now).map((m) => m.id)).toEqual(['1', '2', '4']);
    expect(sendWord(sends[0], en)).toBe('sent — waiting for the computer');
    expect(sendWord(sends[3], tr)).toBe('iletilmedi: x');
    expect(sendWord(sends[4], en)).toBe('not delivered: no wb-opencode took it within an hour');
    expect(sendTone(sends[1])).toBe('ok');
    expect(sendTone(sends[3])).toBe('danger');
  });
});

describe('live records (the stream wbo)', () => {
  const sid = 'ses_aaaaaaaa';
  it('lays deltas on by their place, so a piece told twice is written once', () => {
    let v = { s: detail(), msgs: [] as WboMsg[] };
    const go = (e: object) => {
      const got = applyWbo(v.s, v.msgs, e as never, sid);
      v = { s: got.s!, msgs: got.msgs };
      return got;
    };
    go({ type: 'message', session: sid, id: 'msg_a1', role: 'assistant', model: 'm', time: 5, done: null });
    go({ type: 'delta', session: sid, message: 'msg_a1', part: 't0', delta: 'Hel', o: 0 });
    go({ type: 'delta', session: sid, message: 'msg_a1', part: 't0', delta: 'llo', o: 2 });
    go({ type: 'delta', session: sid, message: 'msg_a1', part: 'r0', delta: 'think', o: 0 });
    expect(v.msgs[0].parts).toEqual([
      { id: 't0', type: 'text', text: 'Hello' },
      { id: 'r0', type: 'reasoning', text: 'think' },
    ]);
    go({
      type: 'part',
      session: sid,
      message: 'msg_a1',
      id: 'call_1',
      part: { id: 'call_1', type: 'tool', tool: 'bash', status: 'running' },
    });
    go({
      type: 'part',
      session: sid,
      message: 'msg_a1',
      id: 'call_1',
      part: { id: 'call_1', type: 'tool', tool: 'bash', status: 'completed' },
    });
    expect(v.msgs[0].parts[2].status).toBe('completed');
    go({ type: 'message', session: sid, id: 'msg_a1', role: 'assistant', done: 9 });
    expect(v.msgs[0].done).toBe(9);
    go({ type: 'status', session: sid, status: 'busy' });
    expect(v.s.status).toBe('busy');
    go({ type: 'session', id: sid, title: 'Renamed' });
    expect(v.s.name).toBe('Renamed');
    go({ type: 'ask', session: sid, ask: ask() });
    expect(v.s.status).toBe('waiting');
    go({ type: 'ask', session: sid, ask: ask({ status: 'answered', via: 'chat' }) });
    expect(v.s.status).toBe('busy');
  });

  it('leaves another session alone and reads again on an error', () => {
    const s = detail();
    const msgs: WboMsg[] = [];
    const other = applyWbo(s, msgs, { type: 'delta', session: 'ses_other', message: 'm', part: 't0', delta: 'x' }, sid);
    expect(other.s).toBe(s);
    expect(other.msgs).toBe(msgs);
    expect(applyWbo(s, msgs, { type: 'error', session: sid, error: 'x' }, sid).read).toBe(true);
  });
});

describe('what OpenCode asks', () => {
  it('picks one, several, or its own words, and is ready when the required ones are answered', () => {
    const one = field();
    const many = field({ key: 'q1', type: 'multiselect', required: false, custom: true });
    const a = ask({ fields: [one, many] });
    let c = NO_CHOICE;
    expect(isReady(a, c)).toBe(false);
    c = choose(c, one, 'a');
    expect(isReady(a, c)).toBe(true);
    c = choose(c, one, 'b');
    expect(c.picks.q0).toEqual(['b']);
    c = choose(c, many, 'a');
    c = choose(c, many, 'b');
    c = choose(c, many, 'a');
    c = setOther(c, many, 'mine');
    expect(answerOf(a, c)).toEqual({ q0: 'b', q1: ['b', 'mine'] });
    c = setOther(c, one, 'free');
    expect(answerOf(a, c).q0).toBe('free');
  });

  it('shows what was answered, and where', () => {
    const a = ask({ status: 'answered', via: 'computer', answer: { q0: 'a' } });
    expect(shownAnswer(a, field())).toBe('Alpha');
    expect(askState(a, en)).toBe('answered on the computer');
    expect(askState({ ...a, via: 'chat' }, tr)).toBe("Sohbet'ten cevaplandı");
    expect(askState(ask({ status: 'answering' }), en)).toBe('sending your answer…');
    expect(askState(ask({ status: 'cancelled' }), en)).toBe('no longer asked');
    const p = ask({ kind: 'permission', status: 'answering', chosen: { decision: 'always' } });
    expect(decisionWord(p, en)).toBe('Always allowed');
    expect(decisionWord({ ...p, status: 'replied', decision: 'reject' }, tr)).toBe('Reddedildi');
  });

  it('puts an open ask at the end when no message held has its tool call', () => {
    const asks = [
      ask({ part: 'call_x' }),
      ask({ id: 'frm_bbbbbbbb', part: 'call_y', status: 'answered', settled_at: 1 }),
    ];
    expect(looseAsks(asks, [], 10_000).map((a) => a.id)).toEqual(['frm_aaaaaaaa']);
    expect(looseAsks(asks, [msg('m', 'assistant', { parts: [{ id: 'call_x', type: 'tool' }] })], 10_000)).toEqual([]);
    expect(putAsk(detail({ bridge: null, status: 'ended' }), ask()).status).toBe('ended');
  });
});
