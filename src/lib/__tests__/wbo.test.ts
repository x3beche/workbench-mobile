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
  localWhy,
  looseAsks,
  NO_CHOICE,
  pendingSends,
  putAsk,
  sendTone,
  sendWord,
  setOther,
  shownAnswer,
  shownWbo,
  toolAnswers,
  toolAsk,
  toStep,
  turnStats,
  updateWord,
  wboDot,
  wboLine,
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

  it('says under a row only what it needs from the person', () => {
    // Working and only-ready are told by the dot alone - it is the dot that pulses.
    expect(wboLine(session({ status: 'busy' }), en)).toBeNull();
    expect(wboLine(session(), en)).toBeNull();
    expect(wboLine(session({ status: 'waiting' }), en)).toBe('waiting for your answer');
    expect(wboLine(session({ status: 'retry' }), tr)).toBe('yeniden deniyor');
    // A session whose wb-opencode is gone says nothing at all: 41 of them saying
    // "not connected" is a list nobody reads.
    expect(wboLine(session({ bridge: null }), en)).toBeNull();
    expect(wboLine(null, en)).toBeNull();
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

  it('draws a question tool call with no ask of it as the card, from its input; what was chosen from its output', () => {
    const qs = [
      {
        header: 'Evet / Hayır',
        question: 'Devam edeyim mi?',
        options: [
          { label: 'Evet', description: 'devam et' },
          { label: 'Hayır', description: 'dur' },
        ],
      },
      {
        header: 'Extras',
        question: 'Which files too?',
        options: [{ label: 'logs' }, { label: 'cache' }],
        multiple: true,
      },
    ];
    const part = {
      id: 'call_q9',
      type: 'tool' as const,
      tool: 'question',
      status: 'running',
      input: JSON.stringify({ questions: qs }),
    };
    const turns = buildTurns([msg('m1', 'assistant', { parts: [part] })]);
    const items = turns[0].kind === 'assistant' ? turns[0].items : [];
    expect(items.map((x) => x.t)).toEqual(['ask']);
    const a = items[0].t === 'ask' ? items[0].ask : ask();
    expect(a).toMatchObject({ id: 'tool-call_q9', local: true, status: 'pending', part: 'call_q9' });
    expect(a.fields?.map((f) => [f.key, f.type, f.title, f.description, f.options.length])).toEqual([
      ['q0', 'string', 'Evet / Hayır', 'Devam edeyim mi?', 2],
      ['q1', 'multiselect', 'Extras', 'Which files too?', 2],
    ]);
    expect(a.fields?.[0].options[0]).toEqual({ value: 'Evet', label: 'Evet', description: 'devam et' });
    expect(askState(a, en)).toBe('waiting for an answer');
    expect(askState(a, tr)).toBe('cevap bekleniyor');
    // the ask the bridge tells takes its place, answerable
    const real = ask({ part: 'call_q9' });
    const withReal = buildTurns([msg('m1', 'assistant', { parts: [part] })], [real]);
    expect(withReal[0].kind === 'assistant' && withReal[0].items).toEqual([
      { t: 'ask', key: 'ask' + real.id, ask: real },
    ]);

    const said =
      'User has answered your questions: "Devam edeyim mi?"="Evet", "Which files too?"="logs, cache". ' +
      "You can now continue with the user's answers in mind.";
    const done = toolAsk({ ...part, status: 'completed', output: said, start: 1000, end: 5000 });
    expect(done).toMatchObject({
      status: 'answered',
      answer: { q0: 'Evet', q1: 'logs, cache' },
      raw: undefined,
      settled_at: 5,
    });
    expect(shownAnswer(done, done.fields![1])).toBe('logs, cache');
    expect(askState(done, en)).toBe('answered');
    expect(
      toolAnswers(
        done.fields!,
        'User has answered your questions: "Devam edeyim mi?"="Unanswered". You can now continue.',
      ),
    ).toEqual({});
    expect(toolAsk({ ...part, status: 'completed', output: 'something else' })).toMatchObject({
      answer: {},
      raw: 'something else',
    });
    const gone = toolAsk({ ...part, status: 'error', error: 'aborted' });
    expect([gone.status, askState(gone, en)]).toEqual(['cancelled', 'no longer asked']);
    // still being written: no questions yet, still a card
    expect(toolAsk({ ...part, input: '{"questions": [' }).fields).toEqual([]);
  });

  it('says why a drawn card is not answered here, and the header asks for a newer wb-opencode', () => {
    const old = session({ bridge: { ...bridge, version: '0.1.0', latest: '0.2.0', outdated: true, answers: false } });
    expect(localWhy(old, en)).toBe('Update wb-opencode on that computer to answer here (run its installer again)');
    expect(localWhy(session({ bridge: { ...bridge, answers: true } }), tr)).toBe('Bilgisayarda cevaplayın');
    expect(localWhy(session({ bridge: null }), en)).toBe('Answer it on the computer');
    expect(updateWord(old, en)).toBe('Update wb-opencode 0.1.0 → 0.2.0');
    expect(updateWord({ bridge: { ...old.bridge!, connected: false } }, tr)).toBe(
      "wb-opencode'u güncelleyin 0.1.0 → 0.2.0",
    );
    expect(updateWord(session(), en)).toBeNull();
  });
});

describe('how the run came', () => {
  /** The stats of the answer in these messages, the window said as the app's catalog would. */
  const came = (msgs: WboMsg[]) => {
    const tn = buildTurns(msgs, []).find((t) => t.kind === 'assistant');
    if (!tn || tn.kind !== 'assistant') throw new Error('no answer in these messages');
    return turnStats(tn, (model) => (model === 'deepseek/deepseek-v4' ? 200_000 : null));
  };
  const step = (id: string, over: Partial<WboMsg> = {}) => msg(id, 'assistant', over);

  it('counts a turn as one answer: its steps together', () => {
    const st = came([
      msg('u1', 'user', { time: 500 }),
      step('m1', {
        model: 'deepseek/deepseek-v4',
        provider: 'workbench',
        time: 1000,
        first: 1400,
        done: 3000,
        tok: [100, 50, 20, 0],
        parts: [
          { id: 'r0', type: 'reasoning', text: 'Look at U3.', start: 1000 },
          { id: 't0', type: 'text', text: 'It drops out.' },
        ],
      }),
      step('m2', {
        model: 'deepseek/deepseek-v4',
        provider: 'workbench',
        time: 3200,
        first: 3400,
        done: 5000,
        tok: [300, 120, 280, 10],
        parts: [{ id: 't0', type: 'text', text: 'Bulk capacitance.' }],
      }),
    ])!;
    expect(st.sent).toBe(1000);
    expect(st.first).toBe(1400);
    expect(st.done).toBe(5000);
    expect(st.out).toBe(170); // 50 + 120: the thinking is inside the output
    expect(st.input).toBe(700); // 100 + 20 read, 300 + 280 read
    expect(st.cacheRead).toBe(300);
    expect(st.cacheWrite).toBe(10);
    expect(st.context).toBe(200_000); // the window the model has, from the catalog
    expect(st.contextTokens).toBe(580); // where it stood at the end: the last step's prompt
    expect(st.model).toBe('deepseek/deepseek-v4');
    expect(st.provider).toBe('Workbench');
    expect(st.thinkingChars).toBe('Look at U3.'.length);
    expect(st.thinkingMs).toBe(2000); // its piece's start to the step's end
  });

  it('reads a first token kept only as its pieces, and has nothing for a run still going', () => {
    const kept = came([
      step('m1', {
        time: 1000,
        first: null,
        done: 4000,
        tok: [10, 20, 0, 0],
        parts: [
          { id: 'r0', type: 'reasoning', text: 'hm', start: 1500 },
          { id: 't0', type: 'text', text: 'x' },
        ],
      }),
    ])!;
    expect(kept.first).toBe(1500);
    // Still being written: no end to count to.
    expect(came([step('m2', { time: 1000, done: null })])).toBeNull();
    // A provider this app does not name is its own id; the named one reads as a person says it.
    expect(came([step('m3', { time: 1, first: 2, done: 3, provider: 'opencode-go' })])!.provider).toBe('OpenCode Go');
  });
});
