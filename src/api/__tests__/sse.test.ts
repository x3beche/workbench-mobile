import type { ChatEvent } from '../types';
import { SseParser, streamSse } from '../sse';
import { FakeXhr } from './fakes';

describe('SseParser', () => {
  it('reads whole blocks', () => {
    const p = new SseParser();
    expect(p.push('data: {"type":"text","text":"Hi"}\n\ndata: {"type":"done"}\n\n')).toEqual([
      { type: 'text', text: 'Hi' },
      { type: 'done' },
    ]);
  });

  it('waits for the rest of a block split anywhere', () => {
    const whole = 'data: {"type":"text","text":"Merhaba dünya"}\n\ndata: {"type":"end","gen":"g1"}\n\n';
    for (let cut = 1; cut < whole.length; cut++) {
      const p = new SseParser();
      const got = [...p.push(whole.slice(0, cut)), ...p.push(whole.slice(cut))];
      expect(got).toEqual([
        { type: 'text', text: 'Merhaba dünya' },
        { type: 'end', gen: 'g1' },
      ]);
    }
  });

  it('accepts CRLF line ends and data: without a space', () => {
    const p = new SseParser();
    expect(p.push('data:{"type":"title","title":"A"}\r\n\r\n')).toEqual([{ type: 'title', title: 'A' }]);
  });

  it('skips keep-alive comments', () => {
    const p = new SseParser();
    expect(p.push(': ping\n\n')).toEqual([]);
    expect(p.push(': ping\n\ndata: {"type":"text","text":"x"}\n\n')).toEqual([{ type: 'text', text: 'x' }]);
  });

  it('skips broken JSON and objects without a type, and keeps going', () => {
    const p = new SseParser();
    expect(p.push('data: {broken\n\ndata: {"no":"type"}\n\ndata: 42\n\ndata: {"type":"done"}\n\n')).toEqual([
      { type: 'done' },
    ]);
  });

  it('joins multi-line data', () => {
    const p = new SseParser();
    expect(p.push('data: {"type":"text",\ndata: "text":"two"}\n\n')).toEqual([{ type: 'text', text: 'two' }]);
  });
});

describe('streamSse', () => {
  function start(extra: Partial<Parameters<typeof streamSse>[0]> = {}) {
    const xhr = new FakeXhr();
    const events: ChatEvent[] = [];
    const activity = jest.fn();
    const done = streamSse({
      url: 'https://wb.example/api/cc/chats/c1/messages',
      method: 'POST',
      headers: { 'x-redline-csrf': '1', 'Content-Type': 'application/json' },
      body: '{"text":"hi"}',
      onEvent: (ev) => events.push(ev),
      onActivity: activity,
      createXhr: () => xhr,
      ...extra,
    });
    return { xhr, events, activity, done };
  }

  it('sends the request with credentials and headers', () => {
    const { xhr } = start();
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('https://wb.example/api/cc/chats/c1/messages');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.headers['x-redline-csrf']).toBe('1');
    expect(xhr.body).toBe('{"text":"hi"}');
  });

  it('hands events over as the text arrives', async () => {
    const { xhr, events, activity, done } = start();
    xhr.respond(200, 'text/event-stream; charset=utf-8');
    xhr.chunk('data: {"type":"user","keep":0}\n\ndata: {"type":"te');
    expect(events.map((e) => e.type)).toEqual(['user']);
    xhr.chunk('xt","text":"He"}\n\n: ping\n\n');
    expect(events.map((e) => e.type)).toEqual(['user', 'text']);
    xhr.chunk('data: {"type":"done"}\n\n');
    xhr.end();
    await expect(done).resolves.toEqual({ status: 200, stream: true, text: '' });
    expect(events.map((e) => e.type)).toEqual(['user', 'text', 'done']);
    expect(activity).toHaveBeenCalledTimes(3);
  });

  it('returns a plain JSON answer (202: the line was queued) without parsing it as events', async () => {
    const { xhr, events, done } = start();
    xhr.respond(202, 'application/json');
    xhr.chunk('{"queued":{"id":"q1","content":"hi"}}');
    xhr.end();
    await expect(done).resolves.toEqual({ status: 202, stream: false, text: '{"queued":{"id":"q1","content":"hi"}}' });
    expect(events).toEqual([]);
  });

  it('returns an error body as text', async () => {
    const { xhr, done } = start();
    xhr.respond(409, 'application/json');
    xhr.chunk('{"detail":"busy"}');
    xhr.end();
    await expect(done).resolves.toEqual({ status: 409, stream: false, text: '{"detail":"busy"}' });
  });

  it('treats an event-stream content type on an error status as not a stream', async () => {
    const { xhr, events, done } = start();
    xhr.respond(500, 'text/event-stream');
    xhr.chunk('data: {"type":"text","text":"x"}\n\n');
    xhr.end();
    await expect(done).resolves.toMatchObject({ status: 500, stream: false });
    expect(events).toEqual([]);
  });

  it('rejects when the server cannot be reached', async () => {
    const { xhr, done } = start();
    xhr.fail();
    await expect(done).rejects.toThrow('The server could not be reached.');
  });

  it('rejects on status 0 at the end (a dropped connection)', async () => {
    const { xhr, done } = start();
    xhr.end();
    await expect(done).rejects.toThrow('could not be reached');
  });

  it('aborts the request and stops handing events over', async () => {
    const ctl = new AbortController();
    const { xhr, events, done } = start({ signal: ctl.signal });
    xhr.respond(200, 'text/event-stream');
    xhr.chunk('data: {"type":"text","text":"a"}\n\n');
    ctl.abort();
    await expect(done).rejects.toMatchObject({ name: 'AbortError' });
    expect(xhr.aborted).toBe(true);
    xhr.chunk('data: {"type":"text","text":"b"}\n\n');
    expect(events).toHaveLength(1);
  });

  it('does not even send when the signal is already aborted', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const { xhr, done } = start({ signal: ctl.signal });
    await expect(done).rejects.toMatchObject({ name: 'AbortError' });
    expect(xhr.method).toBe('');
  });
});
