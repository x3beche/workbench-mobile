import { ApiError, CSRF_HEADER, errorMessage, WorkbenchClient } from '../client';
import { FakeXhr, fakeFetch, jsonResponse } from './fakes';

const BASE = 'https://wb.example';

function headersOf(init: RequestInit): Record<string, string> {
  return (init.headers ?? {}) as Record<string, string>;
}

describe('errorMessage', () => {
  it('prefers the server detail', () => {
    expect(errorMessage(401, '{"detail":"that email and password do not match"}')).toBe(
      'that email and password do not match',
    );
  });
  it('reads a validation error list', () => {
    expect(errorMessage(422, '{"detail":[{"msg":"field required"}]}')).toBe('field required');
  });
  it.each([
    [401, 'Sign in first.'],
    [403, 'Your account may not do that.'],
    [404, 'Not found on this server.'],
    [429, 'Too many tries - wait a while and try again.'],
    [502, 'The server had a problem (HTTP 502).'],
    [418, 'The request failed (HTTP 418).'],
  ])('falls back by status %i', (status, want) => {
    expect(errorMessage(status, '<html>nope</html>')).toBe(want);
  });
});

describe('WorkbenchClient.request', () => {
  it('sends GETs with credentials and without the CSRF header', async () => {
    const f = fakeFetch(() => jsonResponse(200, []));
    await new WorkbenchClient(BASE, { fetch: f.fetch }).listChats();
    const { url, init } = f.calls[0];
    expect(url).toBe(`${BASE}/api/cc/chats?archived=0`);
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(headersOf(init)[CSRF_HEADER]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('puts the CSRF header and a JSON body on every change', async () => {
    const f = fakeFetch(() => jsonResponse(200, { id: 'c1' }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.createChat('openrouter', 'm1');
    await c.setModel('c/1', 'claude', 'm2');
    await c.stop('c1');
    await c.logout();
    expect(f.calls.map((x) => x.init.method)).toEqual(['POST', 'PATCH', 'POST', 'POST']);
    for (const { init } of f.calls) {
      expect(headersOf(init)[CSRF_HEADER]).toBe('1');
      expect(headersOf(init)['Content-Type']).toBe('application/json');
      expect(init.credentials).toBe('include');
    }
    expect(JSON.parse(f.calls[0].init.body as string)).toEqual({ provider: 'openrouter', model: 'm1' });
    expect(f.calls[1].url).toBe(`${BASE}/api/cc/chats/c%2F1`);
  });

  it('posts the login as the web app does, never remembering the device', async () => {
    const f = fakeFetch(() => jsonResponse(200, { user: { id: 'u1', name: 'Ada', email: 'ada@x.org' } }));
    const user = await new WorkbenchClient(BASE, { fetch: f.fetch }).login('  ada@x.org ', 'pw secret');
    expect(user).toEqual({ id: 'u1', name: 'Ada', email: 'ada@x.org' });
    expect(f.calls[0].url).toBe(`${BASE}/api/auth/login`);
    expect(JSON.parse(f.calls[0].init.body as string)).toEqual({
      email: 'ada@x.org',
      password: 'pw secret',
      remember: false,
    });
  });

  it('throws the server detail on a wrong password, without reporting a lost session', async () => {
    const lost = jest.fn();
    const f = fakeFetch(() => jsonResponse(401, { detail: 'that email and password do not match' }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, onUnauthorized: lost });
    await expect(c.login('a@b.c', 'x')).rejects.toEqual(new ApiError(401, 'that email and password do not match'));
    expect(lost).not.toHaveBeenCalled();
  });

  it('reports a lost session on a 401 elsewhere', async () => {
    const lost = jest.fn();
    const f = fakeFetch(() => jsonResponse(401, { detail: 'sign in first' }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, onUnauthorized: lost });
    await expect(c.listChats()).rejects.toMatchObject({ status: 401, message: 'sign in first' });
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('says when the server cannot be reached', async () => {
    const c = new WorkbenchClient(BASE, {
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await expect(c.authState()).rejects.toMatchObject({ status: 0, message: 'The server could not be reached.' });
  });

  it('refuses an answer that is not JSON', async () => {
    const f = fakeFetch(() => jsonResponse(200, '<!doctype html><title>Some site</title>', 'text/html'));
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).authState()).rejects.toThrow('not Workbench');
  });

  it('probe asks /api/health and then /api/auth/state', async () => {
    const f = fakeFetch((url) =>
      url.endsWith('/api/health')
        ? jsonResponse(200, { ok: true })
        : jsonResponse(200, { mode: 'on', user: null, role: null }),
    );
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).probe()).resolves.toMatchObject({ mode: 'on' });
    expect(f.calls.map((x) => x.url)).toEqual([`${BASE}/api/health`, `${BASE}/api/auth/state`]);
  });

  it('probe refuses a server whose health is not Workbench', async () => {
    const f = fakeFetch(() => jsonResponse(200, { status: 'up' }));
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).probe()).rejects.toThrow('does not look like Workbench');
  });

  it('maps the providers of /api/llm/settings', async () => {
    const f = fakeFetch(() =>
      jsonResponse(200, {
        providers: {
          openrouter: { name: 'OpenRouter', set: true, hint: '…abcd' },
          claude: { name: 'Claude API', set: false },
        },
        jobs: {},
      }),
    );
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).providers()).resolves.toEqual([
      { id: 'openrouter', name: 'OpenRouter', set: true },
      { id: 'claude', name: 'Claude API', set: false },
    ]);
  });

  it('asks for models by provider', async () => {
    const f = fakeFetch(() => jsonResponse(200, [{ id: 'a/b', name: 'B' }]));
    await new WorkbenchClient(BASE, { fetch: f.fetch }).models('open router');
    expect(f.calls[0].url).toBe(`${BASE}/api/llm/models?provider=open%20router`);
  });
});

describe('WorkbenchClient.say and live', () => {
  it('streams the answer and resolves with nothing queued', async () => {
    const xhr = new FakeXhr();
    const c = new WorkbenchClient(BASE, { createXhr: () => xhr });
    const events: string[] = [];
    const p = c.say(
      'c1',
      { text: 'hi', provider: 'p', model: 'm', client: 'mobile-1' },
      { onEvent: (e) => events.push(e.type) },
    );
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe(`${BASE}/api/cc/chats/c1/messages`);
    expect(xhr.headers[CSRF_HEADER]).toBe('1');
    expect(xhr.headers.Accept).toBe('text/event-stream');
    expect(JSON.parse(xhr.body as string)).toEqual({ text: 'hi', provider: 'p', model: 'm', client: 'mobile-1' });
    xhr.respond(200, 'text/event-stream');
    xhr.chunk('data: {"type":"user","keep":0}\n\ndata: {"type":"done"}\n\n');
    xhr.end();
    await expect(p).resolves.toEqual({ queued: null });
    expect(events).toEqual(['user', 'done']);
  });

  it('resolves with the queue on a 202', async () => {
    const xhr = new FakeXhr();
    const c = new WorkbenchClient(BASE, { createXhr: () => xhr });
    const p = c.say('c1', { text: 'hi' }, { onEvent: jest.fn() });
    xhr.respond(202, 'application/json');
    xhr.chunk('{"queued":{"id":"q1","content":"hi"},"queue":[],"paused":false}');
    xhr.end();
    await expect(p).resolves.toEqual({ queued: { queued: { id: 'q1', content: 'hi' }, queue: [], paused: false } });
  });

  it('throws the detail of a refused line and reports a lost session', async () => {
    const xhr = new FakeXhr();
    const lost = jest.fn();
    const c = new WorkbenchClient(BASE, { createXhr: () => xhr, onUnauthorized: lost });
    const p = c.say('c1', { text: 'hi' }, { onEvent: jest.fn() });
    xhr.respond(401, 'application/json');
    xhr.chunk('{"detail":"sign in first"}');
    xhr.end();
    await expect(p).rejects.toMatchObject({ status: 401, message: 'sign in first' });
    expect(lost).toHaveBeenCalled();
  });

  it('follows /live with a GET and no CSRF header', async () => {
    const xhr = new FakeXhr();
    const c = new WorkbenchClient(BASE, { createXhr: () => xhr });
    const p = c.live('c1', { onEvent: jest.fn() });
    expect(xhr.method).toBe('GET');
    expect(xhr.url).toBe(`${BASE}/api/cc/chats/c1/live`);
    expect(xhr.headers[CSRF_HEADER]).toBeUndefined();
    expect(xhr.body).toBeNull();
    xhr.respond(200, 'text/event-stream');
    xhr.chunk('data: {"type":"bye"}\n\n');
    xhr.end();
    await expect(p).resolves.toBeUndefined();
  });
});

describe('WorkbenchClient.transcribe', () => {
  type Part = [string, unknown, string | undefined];
  class FakeForm {
    parts: Part[] = [];
    append(name: string, value: unknown, filename?: string) {
      this.parts.push([name, value, filename]);
    }
  }
  const realForm = globalThis.FormData;
  beforeAll(() => {
    (globalThis as unknown as { FormData: unknown }).FormData = FakeForm;
  });
  afterAll(() => {
    globalThis.FormData = realForm;
  });

  const ok = { text: 'merhaba', language: 'tr', model: 'whisper', seconds: 2.5 };

  it('uploads a file on disk as a multipart `audio` part with lang and purpose', async () => {
    const f = fakeFetch(() => jsonResponse(200, ok));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await expect(
      c.transcribe({ uri: 'file:///rec.m4a', name: 'voice.m4a', type: 'audio/mp4' }, 'tr', 'note'),
    ).resolves.toEqual(ok);
    const { url, init } = f.calls[0];
    expect(url).toBe(`${BASE}/api/voice/transcribe`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(headersOf(init)[CSRF_HEADER]).toBe('1');
    // The multipart boundary is the platform's to set.
    expect(headersOf(init)['Content-Type']).toBeUndefined();
    const parts = (init.body as unknown as FakeForm).parts;
    expect(parts).toEqual([
      ['audio', { uri: 'file:///rec.m4a', name: 'voice.m4a', type: 'audio/mp4' }, undefined],
      ['lang', 'tr', undefined],
      ['purpose', 'note', undefined],
    ]);
  });

  it('uploads a browser recording as a blob with its file name, purpose chat by default', async () => {
    const f = fakeFetch(() => jsonResponse(200, ok));
    const blob = { size: 3, type: 'audio/webm' } as unknown as Blob;
    await new WorkbenchClient(BASE, { fetch: f.fetch }).transcribe({ blob, name: 'voice.webm' }, 'auto');
    const parts = (f.calls[0].init.body as unknown as FakeForm).parts;
    expect(parts[0]).toEqual(['audio', blob, 'voice.webm']);
    expect(parts[1]).toEqual(['lang', 'auto', undefined]);
    expect(parts[2]).toEqual(['purpose', 'chat', undefined]);
  });

  it('says plainly when the server has no voice route', async () => {
    const f = fakeFetch(() => jsonResponse(404, { detail: 'Not Found' }));
    await expect(
      new WorkbenchClient(BASE, { fetch: f.fetch }).transcribe(
        { uri: 'file:///a.m4a', name: 'a.m4a', type: 'audio/mp4' },
        'en',
      ),
    ).rejects.toMatchObject({ status: 404, message: expect.stringContaining('cannot transcribe voice yet') });
  });

  it.each([
    [400, 'the recording is longer than 5 minutes'],
    [503, 'voice is not configured on this server'],
    [502, 'the provider failed'],
  ])('passes on the detail of a %i', async (status, detail) => {
    const f = fakeFetch(() => jsonResponse(status, { detail }));
    await expect(
      new WorkbenchClient(BASE, { fetch: f.fetch }).transcribe(
        { uri: 'file:///a.m4a', name: 'a.m4a', type: 'audio/mp4' },
        'en',
      ),
    ).rejects.toEqual(new ApiError(status, detail));
  });

  it('says when the upload cannot reach the server', async () => {
    const c = new WorkbenchClient(BASE, {
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await expect(c.transcribe({ uri: 'file:///a.m4a', name: 'a.m4a', type: 'audio/mp4' }, 'en')).rejects.toMatchObject({
      status: 0,
      message: 'The server could not be reached.',
    });
  });
});
