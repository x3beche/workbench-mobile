/** The Claude sessions without drawing them: words, the drawer's list, turns by the page, sent lines, pictures. */
import type { WbcMessage, WbcSession, WbcTurn } from '../../api/types';
import {
  admit,
  layTurns,
  liveDot,
  MARK,
  pendingOf,
  pictureType,
  putOlderTurns,
  serverWords,
  shownSessions,
  stateWord,
  statusTone,
  statusWord,
  unmark,
  whyText,
  type Picked,
} from '../wbc';
import { inFront } from '../../live/hub';
import { wbcStrings } from '../wbcStrings';

const en = wbcStrings('en');
const tr = wbcStrings('tr');
const NOW = 1_800_000_000;

const turn = (id: string, role: 'user' | 'assistant', at: number, over: Partial<WbcTurn> = {}): WbcTurn => ({
  id,
  role,
  text: `${role} ${id}`,
  at,
  ...over,
});

const session = (over: Partial<WbcSession> = {}): WbcSession => ({
  session_id: 's1',
  name: 'Rail sag',
  title: '',
  status: 'idle',
  computer: 'ada-laptop',
  first_ts: NOW - 4000,
  last_ts: NOW - 100,
  prompts: 3,
  requests: 10,
  known: true,
  mine: true,
  owner: { id: 'u1', name: 'Ada' },
  bridge: null,
  may_send: false,
  why: 'no-bridge',
  ...over,
});

const bridge = (state: 'starting' | 'idle' | 'working' | 'waiting' | 'ended', connected = true) => ({
  id: 'b',
  connected,
  state,
  detail: '',
  remote: true,
  host: 'h',
  platform: 'linux',
  version: '0.2.0',
  cwd: '',
  queue: 0,
  seen: NOW,
  started: NOW,
});

const msg = (over: Partial<WbcMessage> = {}): WbcMessage => ({
  id: 'm1',
  text: 'run the tests',
  by: { id: 'u1', name: 'Ada' },
  status: 'queued',
  detail: '',
  error: '',
  at: NOW - 10,
  updated: NOW - 10,
  delivered_at: null,
  ...over,
});

describe('what the bridge does, in words and as a dot', () => {
  it('says the state while wb-claude holds it, the status otherwise', () => {
    expect(stateWord(session({ bridge: bridge('idle') }), en)).toBe('at the prompt');
    expect(stateWord(session({ bridge: bridge('working') }), en)).toBe('working');
    expect(stateWord(session({ bridge: bridge('waiting') }), en)).toBe('waiting for an answer on the computer');
    expect(stateWord(session({ bridge: bridge('working', false), status: 'ended' }), en)).toBe('ended');
    expect(stateWord(session({ bridge: bridge('idle') }), tr)).toBe('istemde bekliyor');
    expect(stateWord(session({ status: 'active' }), tr)).toBe('etkin');
  });

  it('is green at the prompt, pulsing while working, amber while it waits, none unconnected', () => {
    expect(liveDot(bridge('idle'))).toBe('idle');
    expect(liveDot(bridge('working'))).toBe('running');
    expect(liveDot(bridge('waiting'))).toBe('retry');
    expect(liveDot(bridge('starting'))).toBe('retry');
    expect(liveDot(bridge('idle', false))).toBeNull();
    expect(liveDot(null)).toBeNull();
  });
});

describe("the drawer's list", () => {
  it('keeps the connected ones and the last day, and the open one', () => {
    const rows = [
      session({ session_id: 'live', bridge: bridge('idle'), last_ts: NOW - 5 * 86400 }),
      session({ session_id: 'today', last_ts: NOW - 3600 }),
      session({ session_id: 'old', last_ts: NOW - 3 * 86400 }),
      session({ session_id: 'open', last_ts: NOW - 9 * 86400 }),
    ];
    expect(shownSessions(rows, '', 'open', NOW).map((s) => s.session_id)).toEqual(['live', 'today', 'open']);
  });

  it('is narrowed by a search on the name and the computer', () => {
    const rows = [
      session({ session_id: 'a', name: 'Rail sag', computer: 'laptop' }),
      session({ session_id: 'b', name: 'OTA', computer: 'workstation' }),
    ];
    expect(shownSessions(rows, 'rail', null, NOW).map((s) => s.session_id)).toEqual(['a']);
    expect(shownSessions(rows, 'WORK', null, NOW).map((s) => s.session_id)).toEqual(['b']);
    expect(shownSessions(rows, 'nothing', null, NOW)).toEqual([]);
  });
});

describe('turns, a page at a time', () => {
  it('lays the newest page over what is held, keeping the older pages', () => {
    const held = [turn('1', 'user', 1), turn('1', 'assistant', 2), turn('2', 'user', 3), turn('2', 'assistant', 4)];
    const page = {
      turns: [turn('2', 'user', 3), turn('2', 'assistant', 4, { text: 'longer' }), turn('3', 'user', 5)],
      more: true,
      before: 3,
    };
    const { turns, gap } = layTurns(held, page);
    expect(gap).toBe(false);
    expect(turns.map((t) => `${t.id}${t.role[0]}`)).toEqual(['1u', '1a', '2u', '2a', '3u']);
    expect(turns[3].text).toBe('longer');
  });

  it('starts again from the page when more was said than a page holds', () => {
    const held = [turn('1', 'user', 1), turn('1', 'assistant', 2)];
    const page = { turns: [turn('9', 'user', 90), turn('9', 'assistant', 91)], more: true, before: 90 };
    expect(layTurns(held, page)).toEqual({ turns: page.turns, gap: true });
    // The first read: just the page.
    expect(layTurns(null, page).turns).toEqual(page.turns);
  });

  it('puts an older page before, without twice the same turn', () => {
    const held = [turn('2', 'user', 3), turn('2', 'assistant', 4)];
    const { turns, added } = putOlderTurns(held, [
      turn('1', 'user', 1),
      turn('1', 'assistant', 2),
      turn('2', 'user', 3),
    ]);
    expect(added).toBe(2);
    expect(turns.map((t) => t.at)).toEqual([1, 2, 3, 4]);
    expect(putOlderTurns(held, held).added).toBe(0);
  });
});

describe('lines sent from here', () => {
  it('takes the mark off a remote prompt', () => {
    expect(unmark(`${MARK} hello`)).toBe('hello');
    expect(unmark('typed on the computer')).toBe('typed on the computer');
  });

  it('shows what waits, and what was delivered until the conversation has it', () => {
    const waiting = msg({ id: 'w', status: 'waiting' });
    const shown = msg({ id: 'd1', status: 'delivered', delivered_at: NOW - 30, text: 'run the tests' });
    const notYet = msg({ id: 'd2', status: 'delivered', delivered_at: NOW - 30, text: 'and the linter' });
    const old = msg({ id: 'f', status: 'failed', at: NOW - 4000 });
    const turns = [turn('t', 'user', NOW - 20, { remote: true, text: `${MARK} run the tests` })];
    expect(pendingOf([waiting, shown, notYet, old], turns, MARK, NOW).map((m) => m.id)).toEqual(['w', 'd2']);
  });

  it('knows a picture sent alone by the remote prompt with pictures after it', () => {
    const pic = msg({
      id: 'p',
      text: '',
      status: 'delivered',
      delivered_at: NOW - 30,
      images: [{ n: 0, type: 'image/png', bytes: 9 }],
    });
    const turns = [
      turn('t', 'user', NOW - 10, { remote: true, text: MARK, images: [{ req: 't', n: 0, type: 'image/png' }] }),
    ];
    expect(pendingOf([pic], turns, MARK, NOW)).toEqual([]);
    expect(pendingOf([pic], [], MARK, NOW)).toHaveLength(1);
  });

  it('says what became of each, in both languages', () => {
    expect(statusWord(msg({ status: 'queued' }), en)).toBe('sent — waiting for the computer');
    expect(statusWord(msg({ status: 'waiting' }), en)).toBe('queued — Claude is working');
    expect(statusWord(msg({ status: 'waiting', detail: 'typing' }), en)).toBe(
      'queued — you are typing on the computer',
    );
    expect(statusWord(msg({ status: 'waiting', detail: 'dialog' }), tr)).toBe(
      'sırada — Claude bilgisayarda bir şey soruyor',
    );
    expect(statusWord(msg({ status: 'delivered' }), tr)).toBe('teslim edildi');
    expect(statusWord(msg({ status: 'expired' }), en)).toBe('not delivered: no wb-claude took it within an hour');
    expect(statusWord(msg({ status: 'failed', error: 'the pictures could not be fetched' }), en)).toBe(
      'not delivered: the pictures could not be fetched',
    );
    expect(statusTone(msg({ status: 'delivered' }))).toBe('ok');
    expect(statusTone(msg({ status: 'waiting' }))).toBeNull();
    expect(statusTone(msg({ status: 'refused' }))).toBe('danger');
  });
});

describe('why the composer is a note', () => {
  it("says it in the server's terms", () => {
    expect(whyText({ why: 'not-yours', owner: { id: 'u2', name: 'Can' } }, en)).toBe(
      'Only Can can write to this session; you can read it.',
    );
    expect(whyText({ why: 'not-yours', owner: { id: null, name: '' } }, tr)).toBe(
      'Bu oturuma yalnızca sahibi yazabilir; siz okuyabilirsiniz.',
    );
    expect(whyText({ why: 'no-bridge', owner: { id: null, name: '' } }, en)).toContain(
      'start it on its computer with wb-claude',
    );
    expect(whyText({ why: 'remote-off', owner: { id: null, name: '' } }, tr)).toBe(
      'wb-claude bağlı, ancak o bilgisayarda uzaktan mesajlar kapalı.',
    );
    expect(whyText({ why: 'page', owner: { id: null, name: '' } }, en)).toBe('Read-only.');
  });

  it("puts the server's refusals in Turkish as the web does", () => {
    expect(serverWords('no wb-claude is connected to this session', tr)).toBe('bu oturuma bağlı bir wb-claude yok');
    expect(serverWords('something new', tr)).toBe('something new');
    expect(serverWords('the message is empty', en)).toBe('the message is empty');
  });
});

describe('pictures for a message', () => {
  const p = (key: string, type = 'image/png', size = 1000): Picked => ({
    key,
    part: { uri: `file:///${key}`, name: `${key}.png`, type },
    uri: `file:///${key}`,
    type,
    size,
  });

  it('takes png, jpeg, gif and webp up to four of 5 MB', () => {
    const r = admit([p('a')], [p('b', 'image/jpeg'), p('c', 'image/heic'), p('d', 'image/webp', 6 * 1048576)], en);
    expect(r.pics.map((x) => x.key)).toEqual(['a', 'b']);
    expect(r.error).toBe('A picture is at most 5 MB.');
    const full = admit([p('a'), p('b'), p('c'), p('d')], [p('e')], tr);
    expect(full.pics).toHaveLength(4);
    expect(full.error).toBe('Bir mesajla en fazla 4 resim gider.');
    expect(admit([], [p('h', 'image/heic')], en).error).toBe('Only png, jpeg, gif and webp pictures can be sent.');
  });

  it("knows a picture's type by the picker's word or by its name", () => {
    expect(pictureType('image/jpg', 'x')).toBe('image/jpeg');
    expect(pictureType(undefined, 'Shot.PNG')).toBe('image/png');
    expect(pictureType(null, 'a.webp')).toBe('image/webp');
    expect(pictureType('', 'a.heic')).toBe('');
  });
});

describe('reading only in the front', () => {
  it('rests in the background, reads in the front or when the state is not known', () => {
    expect(inFront({ currentState: 'background' })).toBe(false);
    expect(inFront({ currentState: 'inactive' })).toBe(false);
    expect(inFront({ currentState: 'active' })).toBe(true);
    expect(inFront({ currentState: 'unknown' })).toBe(true);
    expect(inFront({})).toBe(true);
    expect(inFront(null)).toBe(true);
  });
});
