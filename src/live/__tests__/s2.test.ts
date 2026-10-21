/**
 * The live streams through S2 (live/s2.ts, live/hub.ts): one token per
 * account shared by its streams, the token only in the Authorization header,
 * resuming from seq_num, renewals and refusals that never sign anyone out,
 * an older server left to its polling, and the reads closed in the background.
 */
import { WorkbenchClient } from '../../api/client';
import { RawSseParser } from '../../api/sse';
import type { BusEvent, S2Token } from '../../api/types';
import { FakeXhr, fakeFetch, jsonResponse } from '../../api/__tests__/fakes';
import { LiveHub, type AppStateLike } from '../hub';
import { forgetS2Tokens, S2Follow } from '../s2';

const SECRET = 'tok-SECRET-123';

function token(over: Partial<S2Token> = {}): S2Token {
  return {
    token: SECRET,
    expires_at: Date.now() / 1000 + 900,
    basin: 'workbench-live',
    stream: 'acct/a1/activity',
    prefix: 'acct/a1/',
    path: '/s2',
    ...over,
  };
}

/** A server: the token route, the streams route, the tail, and every live read as a FakeXhr. */
function server(opts: { tokenStatus?: number; tail?: number; tokens?: () => S2Token } = {}) {
  const xhrs: FakeXhr[] = [];
  const unauthorized = jest.fn();
  let n = 0;
  const net = fakeFetch((url, init) => {
    if (url.endsWith('/api/s2/token')) {
      n++;
      if (opts.tokenStatus) return jsonResponse(opts.tokenStatus, { detail: opts.tokenStatus === 404 ? 'Not Found' : 'no' });
      return jsonResponse(200, opts.tokens ? opts.tokens() : token());
    }
    if (url.endsWith('/api/s2/streams')) return jsonResponse(200, { ready: JSON.parse(String(init.body)).names });
    if (url.includes('/records/tail')) return jsonResponse(200, { tail: { seq_num: opts.tail ?? 40, timestamp: 0 } });
    return jsonResponse(404, { detail: 'Not Found' });
  });
  const client = new WorkbenchClient('https://wb.example', {
    fetch: net.fetch,
    createXhr: () => {
      const x = new FakeXhr();
      xhrs.push(x);
      return x;
    },
    session: 'sess-1',
    onUnauthorized: unauthorized,
  });
  return { client, xhrs, net, unauthorized, asked: () => n };
}

const batch = (recs: { seq: number; body: unknown }[]) =>
  `event: batch\ndata: ${JSON.stringify({ records: recs.map((r) => ({ seq_num: r.seq, body: JSON.stringify(r.body), timestamp: 0 })) })}\n\n`;

const flush = async (ms = 0) => {
  await jest.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  jest.useFakeTimers();
  forgetS2Tokens();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('RawSseParser', () => {
  it('reads named events, joins data lines and says a comment block as a keep-alive', () => {
    const p = new RawSseParser();
    expect(p.push('event: batch\ndata: {"a":\ndata: 1}\n\n: ping\n\nevent: error\ndata: gone\n\n')).toEqual([
      { event: 'batch', data: '{"a":\n1}' },
      { event: '', data: '' },
      { event: 'error', data: 'gone' },
    ]);
  });
});

describe('S2Follow', () => {
  it('reads with the token in the Authorization header only, no cookies, from the latest record', async () => {
    const s = server();
    const got: unknown[] = [];
    const f = new S2Follow(s.client, (v) => got.push(v));
    f.start();
    await flush();
    expect(s.xhrs).toHaveLength(1);
    const x = s.xhrs[0];
    expect(x.url).toBe('https://wb.example/s2/v1/streams/acct%2Fa1%2Factivity/records?tail_offset=1&clamp=true');
    expect(x.url).not.toContain(SECRET);
    expect(x.headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(x.headers.Accept).toBe('text/event-stream');
    expect(x.headers['x-workbench-session']).toBeUndefined();
    expect(x.withCredentials).toBe(false);
    x.respond(200, 'text/event-stream');
    expect(f.live()).toBe(false); // figures: live once a record came
    x.chunk(batch([{ seq: 7, body: { n: 1 } }, { seq: 8, body: { n: 2 } }]));
    expect(got).toEqual([{ n: 2 }]); // only the last of a batch
    expect(f.live()).toBe(true);
    f.stop();
  });

  it('shares one token between the streams of an account and asks once', async () => {
    const s = server();
    const a = new S2Follow(s.client, () => undefined);
    const b = new S2Follow(s.client, () => undefined, { stream: 'bus' });
    a.start();
    b.start();
    await flush();
    expect(s.asked()).toBe(1);
    expect(s.xhrs.map((x) => x.url.split('?')[0].split('/streams/')[1])).toEqual([
      'acct%2Fa1%2Factivity/records',
      'acct%2Fa1%2Fbus/records',
    ]);
    a.stop();
    b.stop();
  });

  it('starts an event stream at its tail, delivers every record, and goes on from the last seq when cut', async () => {
    const s = server({ tail: 40 });
    const got: BusEvent[] = [];
    const opened = jest.fn();
    const f = new S2Follow<BusEvent>(s.client, (e) => got.push(e), { stream: 'bus', every: true, fromTail: true, onOpen: opened });
    f.start();
    await flush();
    expect(s.net.calls.some((c) => c.url.endsWith('/records/tail'))).toBe(true);
    const tailCall = s.net.calls.find((c) => c.url.endsWith('/records/tail'))!;
    expect((tailCall.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    expect(tailCall.init.credentials).toBe('omit');
    const x = s.xhrs[0];
    expect(x.url).toContain('?seq_num=40&clamp=true');
    x.respond(200, 'text/event-stream');
    expect(opened).toHaveBeenCalledTimes(1);
    expect(f.live()).toBe(true); // an event stream: live once open
    x.chunk(batch([{ seq: 40, body: { k: 'line', p: { room: 'pcb' } } }, { seq: 41, body: { k: 'cc', p: { id: 'c1' } } }]));
    expect(got.map((e) => e.k)).toEqual(['line', 'cc']);
    // The server closes the read: opened again from the record after the last.
    x.end();
    await flush(250);
    expect(s.xhrs).toHaveLength(2);
    expect(s.xhrs[1].url).toContain('?seq_num=42&clamp=true');
    f.stop();
  });

  it('asks for a new token when the gate refuses it, and never signs the account out', async () => {
    const s = server();
    const f = new S2Follow(s.client, () => undefined);
    f.start();
    await flush();
    s.xhrs[0].respond(401, 'application/json');
    s.xhrs[0].end();
    await flush(1100);
    expect(s.asked()).toBe(2);
    expect(s.xhrs).toHaveLength(2);
    expect(s.unauthorized).not.toHaveBeenCalled();
    f.stop();
  });

  it('a 401 of the token route itself does not sign out either: it backs off', async () => {
    const s = server({ tokenStatus: 401 });
    const f = new S2Follow(s.client, () => undefined);
    f.start();
    await flush();
    expect(s.xhrs).toHaveLength(0);
    expect(s.unauthorized).not.toHaveBeenCalled();
    await flush(1100);
    expect(s.asked()).toBe(2);
    f.stop();
  });

  it('leaves an older server (no token route) to its polling and does not ask again', async () => {
    const s = server({ tokenStatus: 404 });
    const f = new S2Follow(s.client, () => undefined);
    f.start();
    await flush(400_000);
    expect(s.asked()).toBe(1);
    expect(f.live()).toBe(false);
    f.stop();
  });

  it('opens again at once when the gate ends the read (an error event)', async () => {
    const s = server();
    const f = new S2Follow(s.client, () => undefined, { stream: 'bus', every: true, onOpen: () => undefined });
    f.start();
    await flush();
    const x = s.xhrs[0];
    x.respond(200, 'text/event-stream');
    x.chunk(batch([{ seq: 3, body: { k: 'x' } }]));
    x.chunk('event: error\ndata: {"error":"expired"}\n\n');
    expect(x.aborted).toBe(true);
    await flush();
    expect(f.live()).toBe(false);
    await flush(250);
    expect(s.xhrs).toHaveLength(2);
    expect(s.xhrs[1].url).toContain('seq_num=4');
    f.stop();
  });

  it('opens a silent read again after 30 s, and renews the token a minute before it ends', async () => {
    let made = 0;
    const s = server({ tokens: () => token({ token: `${SECRET}-${++made}`, expires_at: Date.now() / 1000 + 200 }) });
    const f = new S2Follow(s.client, () => undefined, { stream: 'bus', every: true, onOpen: () => undefined });
    f.start();
    await flush();
    s.xhrs[0].respond(200, 'text/event-stream');
    await flush(30_001);
    expect(s.xhrs[0].aborted).toBe(true);
    expect(s.xhrs).toHaveLength(2);
    // The token has 200 s: renewed 60 s before its end, with a new token on the new read.
    s.xhrs[1].respond(200, 'text/event-stream');
    for (let i = 0; i < 6; i++) {
      s.xhrs.at(-1)!.chunk(': ping\n\n');
      await flush(20_000);
    }
    expect(made).toBeGreaterThanOrEqual(2);
    expect(s.xhrs.at(-1)!.headers.Authorization).toBe(`Bearer ${SECRET}-2`);
    f.stop();
  });

  it('makes an on-demand stream ready before reading it, and again after a 404', async () => {
    const s = server();
    const prepare = jest.fn(async () => s.client.s2Streams(['orch']));
    const f = new S2Follow(s.client, () => undefined, { stream: 'orch', every: true, prepare });
    f.start();
    await flush();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(s.net.calls.find((c) => c.url.endsWith('/api/s2/streams'))?.init.body).toBe('{"names":["orch"]}');
    s.xhrs[0].respond(404, 'application/json');
    s.xhrs[0].end();
    await flush(1100);
    expect(prepare).toHaveBeenCalledTimes(2);
    f.stop();
  });
});

describe('several accounts', () => {
  it('gives each account (server and session) its own token', async () => {
    const a = server();
    const b = server();
    const other = new WorkbenchClient('https://wb.example', { fetch: b.net.fetch, createXhr: () => new FakeXhr(), session: 'sess-2' });
    const fa = new S2Follow(a.client, () => undefined);
    const fb = new S2Follow(other, () => undefined);
    fa.start();
    fb.start();
    await flush();
    expect(a.asked()).toBe(1);
    expect(b.asked()).toBe(1);
    fa.stop();
    fb.stop();
  });
});

describe('LiveHub', () => {
  function appState() {
    let fn: ((s: string) => void) | null = null;
    const st: AppStateLike = {
      currentState: 'active',
      addEventListener: (_t, f) => {
        fn = f as (s: string) => void;
        return { remove: () => (fn = null) };
      },
    };
    return { st, go: (s: string) => fn?.(s) };
  }

  it('reads the bus only while someone listens, by kind, saying $open and $down', async () => {
    const s = server();
    const a = appState();
    const hub = new LiveHub(s.client, a.st);
    await flush();
    expect(s.xhrs).toHaveLength(0);
    const heard: string[] = [];
    const off = hub.on(['line'], (e) => heard.push(e.k));
    await flush();
    expect(s.xhrs).toHaveLength(1);
    s.xhrs[0].respond(200, 'text/event-stream');
    expect(hub.live()).toBe(true);
    s.xhrs[0].chunk(batch([{ seq: 40, body: { k: 'line', p: { room: 'pcb' } } }, { seq: 41, body: { k: 'orch' } }]));
    expect(heard).toEqual(['$open', 'line']);
    s.xhrs[0].fail();
    await flush();
    expect(heard).toEqual(['$open', 'line', '$down']);
    off();
    await flush(2000);
    expect(s.xhrs).toHaveLength(1); // nobody listens: not opened again
    hub.dispose();
  });

  it('closes every read in the background and goes on from where it was in the front', async () => {
    const s = server();
    const a = appState();
    const hub = new LiveHub(s.client, a.st);
    hub.on(['cc'], () => undefined);
    const act = hub.follow(() => undefined);
    act.start();
    await flush();
    expect(s.xhrs).toHaveLength(2);
    const bus = s.xhrs.find((x) => x.url.includes('%2Fbus'))!;
    bus.respond(200, 'text/event-stream');
    bus.chunk(batch([{ seq: 50, body: { k: 'cc' } }]));
    a.go('background');
    expect(s.xhrs[0].aborted && s.xhrs[1].aborted).toBe(true);
    expect(hub.live()).toBe(false);
    await flush(60_000);
    expect(s.xhrs).toHaveLength(2); // nothing read in the background
    a.go('active');
    await flush();
    expect(s.xhrs).toHaveLength(4);
    expect(s.xhrs.some((x) => x.url.includes('%2Fbus') && x.url.includes('seq_num=51'))).toBe(true);
    hub.dispose();
    expect(s.xhrs.slice(2).every((x) => x.aborted)).toBe(true);
  });

  it('a pace rests a poller while the bus is up, and polls each tick while it is down', async () => {
    const s = server();
    const hub = new LiveHub(s.client, appState().st);
    const pace = hub.pace(60_000);
    expect(pace.due()).toBe(true);
    expect(pace.due()).toBe(true); // bus down: every tick
    hub.on(['x'], () => undefined);
    await flush();
    s.xhrs[0].respond(200, 'text/event-stream');
    expect(pace.due()).toBe(false);
    await flush(29_000);
    s.xhrs[0].chunk(': ping\n\n');
    await flush(29_000);
    s.xhrs[0].chunk(': ping\n\n');
    await flush(3_000);
    expect(pace.due()).toBe(true); // the safety net
    hub.dispose();
  });
});

describe('the client', () => {
  it('never signs out for /api/s2/ and keeps signing out for the session', async () => {
    const unauthorized = jest.fn();
    const net = fakeFetch(() => jsonResponse(401, { detail: 'no' }));
    const c = new WorkbenchClient('https://wb.example', { fetch: net.fetch, onUnauthorized: unauthorized });
    await expect(c.s2Token()).rejects.toThrow();
    expect(await c.s2Streams(['orch'])).toBe(false);
    expect(unauthorized).not.toHaveBeenCalled();
    await expect(c.rooms()).rejects.toThrow();
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('asks the Orchestrator events quietly with ?via=s2', async () => {
    const x = new FakeXhr();
    const c = new WorkbenchClient('https://wb.example', { createXhr: () => x });
    void c.orchestratorEvents({ onEvent: () => undefined, quiet: true }).catch(() => undefined);
    expect(x.url).toBe('https://wb.example/api/me/orchestrator/events?via=s2');
  });
});
