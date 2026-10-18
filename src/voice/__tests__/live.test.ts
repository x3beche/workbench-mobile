/** The live voice to text protocol (WS /api/voice/live), against a fake socket. */
import { FRAME_BYTES, joinWords, LiveSession, liveUrl } from '../live';
import { FakeSocket } from './fakeSocket';

function session(on = {}) {
  const words: [string, string][] = [];
  const broke: string[] = [];
  const lv = new LiveSession(
    'wss://wb.example/api/voice/live',
    { lang: 'tr', purpose: 'chat' },
    { words: (s: string, t: string) => words.push([s, t]), broke: (c: string) => broke.push(c), ...on },
    (url) => new FakeSocket(url),
  );
  return { lv, words, broke };
}

const pcm = (n: number) => new Uint8Array(n).fill(1);

beforeEach(() => {
  FakeSocket.all = [];
});

describe('liveUrl', () => {
  it('puts the socket beside the server, ws for http and wss for https', () => {
    expect(liveUrl('https://wb.example')).toBe('wss://wb.example/api/voice/live');
    expect(liveUrl('http://192.168.1.20:8000/')).toBe('ws://192.168.1.20:8000/api/voice/live');
  });
});

describe('joinWords', () => {
  it('joins with one space, none doubled', () => {
    expect(joinWords('', 'hello')).toBe('hello');
    expect(joinWords('Note:', ' hello')).toBe('Note: hello');
    expect(joinWords('Note: ', 'hello')).toBe('Note: hello');
    expect(joinWords('Note:', '')).toBe('Note:');
  });
});

describe('LiveSession', () => {
  it('starts with the language and PCM16, keeps the first words until ready, then streams in frames', async () => {
    const { lv } = session();
    const opened = lv.open();
    const ws = FakeSocket.last();
    expect(ws.url).toBe('wss://wb.example/api/voice/live');
    ws.open();
    expect(ws.messages()).toEqual([{ type: 'start', lang: 'tr', purpose: 'chat', format: 'pcm16', polish: false }]);
    lv.push(pcm(5000)); // spoken before the server was ready
    expect(ws.audioBytes()).toBe(0);
    ws.say({ type: 'ready', model: 'small' });
    expect(await opened).toEqual({ ok: true, model: 'small' });
    expect(lv.live).toBe(true);
    expect(ws.audioBytes()).toBe(5000);
    lv.push(pcm(1600));
    expect(ws.audioBytes()).toBe(5000); // under a frame: kept
    lv.push(pcm(1600));
    expect(ws.audioBytes()).toBe(5000 + FRAME_BYTES);
  });

  it('appends the settled words and replaces the unsure tail', async () => {
    const { lv, words } = session();
    const opened = lv.open();
    const ws = FakeSocket.last();
    ws.open();
    ws.say({ type: 'ready', model: 'small' });
    await opened;
    ws.say({ type: 'partial', text: ' merhaba dün' });
    ws.say({ type: 'final', text: ' merhaba' });
    ws.say({ type: 'partial', text: ' dünya' });
    ws.say({ type: 'final', text: ' dünya,' });
    ws.say({ type: 'final', text: ' STM' });
    ws.say({ type: 'final', text: '32' });
    expect(words).toEqual([
      ['', ' merhaba dün'],
      [' merhaba', ''],
      [' merhaba', ' dünya'],
      [' merhaba dünya,', ''],
      [' merhaba dünya, STM', ''],
      [' merhaba dünya, STM32', ''],
    ]);
  });

  it('on finish sends what is left and stop, and gives back the whole text', async () => {
    const { lv } = session();
    const opened = lv.open();
    const ws = FakeSocket.last();
    ws.open();
    ws.say({ type: 'ready', model: 'small' });
    await opened;
    lv.push(pcm(100));
    const done = lv.finish();
    expect(ws.audioBytes()).toBe(100);
    expect(ws.messages().at(-1)).toEqual({ type: 'stop' });
    ws.say({ type: 'done', text: 'Merhaba dünya.', seconds: 2.1, model: 'small', language: 'tr', reason: 'stop' });
    expect(await done).toMatchObject({ text: 'Merhaba dünya.', reason: 'stop' });
    expect(ws.closed).toBe(true);
    expect(lv.live).toBe(false);
  });

  it.each([
    ['busy', 'as many people as it takes are speaking'],
    ['down', 'live voice to text is not running on this server'],
    ['auth', 'sign in first'],
  ])('says why when the server refuses before ready (%s)', async (code, message) => {
    const { lv, broke } = session();
    const opened = lv.open();
    const ws = FakeSocket.last();
    ws.open();
    ws.say({ type: 'error', code, message });
    expect(await opened).toEqual({ ok: false, code, message });
    expect(broke).toEqual([]); // nothing was live: not a break
    lv.push(pcm(4000));
    expect(ws.audioBytes()).toBe(0);
    expect(await lv.finish()).toBeNull();
  });

  it('treats a server without the route (the socket closes unanswered) as not offered', async () => {
    const { lv } = session();
    const opened = lv.open();
    FakeSocket.last().drop();
    expect(await opened).toMatchObject({ ok: false, code: 'closed' });
  });

  it('gives up when the server does not say ready in time', async () => {
    jest.useFakeTimers();
    try {
      const { lv } = session();
      const opened = lv.open(4000);
      const ws = FakeSocket.last();
      ws.open();
      jest.advanceTimersByTime(4000);
      expect(await opened).toMatchObject({ ok: false, code: 'timeout' });
      expect(ws.closed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('says it broke when the stream fails after ready, and finish then gives nothing', async () => {
    const { lv, broke } = session();
    const opened = lv.open();
    const ws = FakeSocket.last();
    ws.open();
    ws.say({ type: 'ready', model: 'small' });
    await opened;
    ws.say({ type: 'error', code: 'failed', message: 'the service stopped' });
    expect(broke).toEqual(['failed']);
    expect(lv.live).toBe(false);
    expect(await lv.finish()).toBeNull();
  });

  it('says it broke when the socket drops mid-way, and a waiting finish gets nothing', async () => {
    const { lv, broke } = session();
    const opened = lv.open();
    const ws = FakeSocket.last();
    ws.open();
    ws.say({ type: 'ready', model: 'small' });
    await opened;
    const done = lv.finish();
    ws.drop();
    expect(await done).toBeNull();
    expect(broke).toEqual(['failed']);
  });
});
