/** The Claude sessions' requests: the account's session on each, JSON or a form, pictures read as data. */
import { CSRF_HEADER, SESSION_HEADER, WorkbenchClient } from '../client';
import { fakeFetch, jsonResponse } from './fakes';

const BASE = 'https://wb.example';
const headersOf = (init: RequestInit) => (init.headers ?? {}) as Record<string, string>;

class NodeFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
      this.onload?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader ??= NodeFileReader;

function raw(status: number, body: string, type = 'image/png'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? type : null) },
    text: async () => body,
    blob: async () => new Blob([body], { type }),
  } as unknown as Response;
}

describe('Claude sessions through the client', () => {
  it("lists one's sessions and reads one, as this account", async () => {
    const f = fakeFetch((url) =>
      jsonResponse(
        200,
        url.endsWith('/api/wbc/sessions') ? { sessions: [{ session_id: 's1' }] } : { session_id: 's 1' },
      ),
    );
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, session: 'sess-a' });
    expect(await c.wbcSessions()).toEqual([{ session_id: 's1' }]);
    await c.wbcSession('s 1');
    expect(f.calls.map((x) => x.url)).toEqual([`${BASE}/api/wbc/sessions`, `${BASE}/api/wbc/sessions/s%201`]);
    for (const x of f.calls) expect(headersOf(x.init)[SESSION_HEADER]).toBe('sess-a');
  });

  it('answers no sessions when the server says none', async () => {
    const f = fakeFetch(() => jsonResponse(200, {}));
    expect(await new WorkbenchClient(BASE, { fetch: f.fetch }).wbcSessions()).toEqual([]);
  });

  it('reads the turns ten at a time, and the page before', async () => {
    const f = fakeFetch(() => jsonResponse(200, { turns: [], more: false, before: null }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.wbcTurns('s1', 10);
    await c.wbcTurns('s1', 10, 1792930000.5);
    expect(f.calls.map((x) => x.url)).toEqual([
      `${BASE}/api/wbc/sessions/s1/turns?limit=10`,
      `${BASE}/api/wbc/sessions/s1/turns?limit=10&before=1792930000.5`,
    ]);
  });

  it('sends words as JSON, and with pictures a form of text and images', async () => {
    const f = fakeFetch(() => jsonResponse(202, { id: 'm1', status: 'queued' }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, session: 'sess-a' });
    await c.wbcSend('s1', 'run the tests');
    expect(f.calls[0].init.method).toBe('POST');
    expect(f.calls[0].init.body).toBe(JSON.stringify({ text: 'run the tests' }));
    expect(headersOf(f.calls[0].init)[CSRF_HEADER]).toBe('1');

    const appended: unknown[][] = [];
    const Real = globalThis.FormData;
    globalThis.FormData = class {
      append(...a: unknown[]) {
        appended.push(a);
      }
    } as unknown as typeof FormData;
    try {
      const blob = { size: 3 } as unknown as Blob;
      const got = await c.wbcSend('s1', '', [
        { uri: 'file:///a.png', name: 'a.png', type: 'image/png' },
        { blob, name: 'b.webp' },
      ]);
      expect(got).toEqual({ id: 'm1', status: 'queued' });
    } finally {
      globalThis.FormData = Real;
    }
    const sent = f.calls[1];
    expect(sent.url).toBe(`${BASE}/api/wbc/sessions/s1/messages`);
    expect(sent.init.method).toBe('POST');
    expect(headersOf(sent.init)[CSRF_HEADER]).toBe('1');
    expect(headersOf(sent.init)[SESSION_HEADER]).toBe('sess-a');
    // No Content-Type of its own: the platform writes the form's boundary.
    expect(headersOf(sent.init)['Content-Type']).toBeUndefined();
    expect(appended[0]).toEqual(['text', '']);
    expect(appended[1]).toEqual(['images', { uri: 'file:///a.png', name: 'a.png', type: 'image/png' }]);
    expect(appended[2]).toEqual(['images', { size: 3 }, 'b.webp']);
  });

  it("gives the server's refusal in its words", async () => {
    const f = fakeFetch(() => jsonResponse(409, { detail: 'no wb-claude is connected to this session' }));
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).wbcSend('s1', 'hi')).rejects.toMatchObject({
      status: 409,
      message: 'no wb-claude is connected to this session',
    });
  });

  it('reads a picture with the session as a data URI; one no longer kept is gone', async () => {
    let answer = raw(200, 'PNG');
    const f = fakeFetch(() => answer);
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, session: 'sess-a' });
    const path = c.wbcTurnImagePath('s1', 'req-1', 0);
    expect(path).toBe('/api/wbc/sessions/s1/images/req-1/0');
    expect(c.wbcMessageImagePath('s1', 'm1', 2)).toBe('/api/wbc/sessions/s1/messages/m1/images/2');
    expect(await c.wbcImage(path)).toBe(`data:image/png;base64,${btoa('PNG')}`);
    expect(headersOf(f.calls[0].init)[SESSION_HEADER]).toBe('sess-a');
    answer = raw(404, '{"detail":"that picture is no longer kept"}', 'application/json');
    expect(await c.wbcImage(path)).toBe('gone');
    answer = raw(503, 'down', 'text/plain');
    expect(await c.wbcImage(path)).toBeNull();
  });
});
