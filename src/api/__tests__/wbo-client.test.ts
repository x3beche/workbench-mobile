/** The OpenCode sessions' and the side prefs' requests: this account's session on each, the bodies the server takes. */
import { SESSION_HEADER, sideOf, WorkbenchClient } from '../client';
import { fakeFetch, jsonResponse } from './fakes';

const BASE = 'https://wb.example';
const headersOf = (init: RequestInit) => (init.headers ?? {}) as Record<string, string>;

describe('OpenCode sessions through the client', () => {
  it("lists one's sessions, reads one and answers what it asks, as this account", async () => {
    const f = fakeFetch((url) =>
      jsonResponse(
        url.includes('/answer') ? 202 : 200,
        url.endsWith('/api/wbo/sessions') ? { sessions: [{ session_id: 'ses_1' }] } : { id: 'x' },
      ),
    );
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, session: 'sess-a' });
    expect(await c.wboSessions()).toEqual([{ session_id: 'ses_1' }]);
    await c.wboSession('ses_1');
    await c.wboAnswer('ses_1', 'frm_1', { answer: { q0: 'a' } });
    await c.wboAnswer('ses_1', 'per_1', { decision: 'once' });
    await c.wboSend('ses_1', 'hello');
    expect(f.calls.map((x) => `${x.init.method ?? 'GET'} ${x.url.slice(BASE.length)}`)).toEqual([
      'GET /api/wbo/sessions',
      'GET /api/wbo/sessions/ses_1',
      'POST /api/wbo/sessions/ses_1/asks/frm_1/answer',
      'POST /api/wbo/sessions/ses_1/asks/per_1/answer',
      'POST /api/wbo/sessions/ses_1/messages',
    ]);
    expect(JSON.parse(String(f.calls[2].init.body))).toEqual({ answer: { q0: 'a' } });
    expect(JSON.parse(String(f.calls[3].init.body))).toEqual({ decision: 'once' });
    expect(JSON.parse(String(f.calls[4].init.body))).toEqual({ text: 'hello' });
    for (const x of f.calls) expect(headersOf(x.init)[SESSION_HEADER]).toBe('sess-a');
    expect(c.wboMessageImagePath('ses_1', 'ab12', 2)).toBe('/api/wbo/sessions/ses_1/messages/ab12/images/2');
  });

  it('sends pictures as a form of text and images', async () => {
    const f = fakeFetch(() => jsonResponse(202, { id: 'm1' }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.wboSend('ses_1', 'look', [{ blob: new Blob(['x'], { type: 'image/png' }), name: 'a.png' }]);
    const body = f.calls[0].init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('text')).toBe('look');
    expect(body.getAll('images')).toHaveLength(1);
  });
});

describe('the side prefs through the client', () => {
  it('reads and changes pins and folds where the web keeps them', async () => {
    const f = fakeFetch(() =>
      jsonResponse(200, { pins: { claude: ['c1'], opencode: [] }, folds: { claude: false, opencode: null } }),
    );
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, session: 'sess-a' });
    expect((await c.side()).folds.claude).toBe(false);
    await c.sidePin('opencode', 'ses_1', true);
    await c.sideFold('claude', true);
    expect(f.calls.map((x) => `${x.init.method ?? 'GET'} ${x.url.slice(BASE.length)}`)).toEqual([
      'GET /api/me/side',
      'PUT /api/me/side/pins',
      'PUT /api/me/side/folds',
    ]);
    expect(JSON.parse(String(f.calls[1].init.body))).toEqual({ group: 'opencode', id: 'ses_1', pinned: true });
    expect(JSON.parse(String(f.calls[2].init.body))).toEqual({ group: 'claude', open: true });
  });

  it('keeps how much of an answer the Chat shows, as the web keeps it', async () => {
    const f = fakeFetch(() => jsonResponse(200, { chat: { detail: 'compact', files: true } }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch, session: 'sess-a' });
    expect((await c.side()).chat.detail).toBe('compact');
    await c.sideChat('detailed');
    expect(f.calls.map((x) => `${x.init.method ?? 'GET'} ${x.url.slice(BASE.length)}`)).toEqual([
      'GET /api/me/side',
      'PUT /api/me/side/chat',
    ]);
    expect(JSON.parse(String(f.calls[1].init.body))).toEqual({ detail: 'detailed' });
  });

  it('fills in what an answer leaves out', () => {
    expect(sideOf(null)).toEqual({
      pins: { claude: [], opencode: [] },
      folds: { claude: null, opencode: null, rooms: null },
      chat: { detail: 'normal' },
    });
    expect(sideOf({ pins: { claude: ['a', 3 as unknown as string] } } as never).pins.claude).toEqual(['a']);
    // A stop the app does not know (a newer server's) is drawn as normal.
    expect(sideOf({ chat: { detail: 'sideways' } } as never).chat.detail).toBe('normal');
    expect(sideOf({ chat: { detail: 'detailed' } } as never).chat.detail).toBe('detailed');
  });
});
