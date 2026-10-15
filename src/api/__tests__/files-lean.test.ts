/**
 * The smaller answers a newer server gives a phone - one's own uploads only,
 * one read-only folder at a time, a picture at the screen's size, the
 * conversation trash's days - and what the app does with an older server
 * that ignores them.
 */
import { CHAT_TRASH_DAYS, WorkbenchClient } from '../client';
import { fakeFetch } from './fakes';

const BASE = 'https://wb.example';

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

function raw(status: number, body: string, headers: Record<string, string> = {}): Response {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n: string) => lower[n.toLowerCase()] ?? null },
    text: async () => body,
    blob: async () => new Blob([body], { type: lower['content-type'] ?? 'application/octet-stream' }),
  } as unknown as Response;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  raw(status, JSON.stringify(body), { 'content-type': 'application/json', ...headers });

describe('one’s own uploads', () => {
  it('asks for area=own, or every upload', async () => {
    const f = fakeFetch(() => json(200, []));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.listFiles(true);
    await c.listFiles();
    expect(f.calls.map((x) => x.url)).toEqual([`${BASE}/api/files?area=own`, `${BASE}/api/files`]);
  });
});

describe('one read-only folder at a time', () => {
  it('reads a folder from a server that answers one', async () => {
    const one = {
      under: 'v:chat',
      trail: [{ id: 'v:chat', name: 'Chat' }],
      folders: [],
      files: [],
      links: [],
      linked: [],
    };
    const f = fakeFetch(() => json(200, one));
    const got = await new WorkbenchClient(BASE, { fetch: f.fetch }).virtualFolder('v:chat');
    expect(f.calls[0].url).toBe(`${BASE}/api/files/virtual?under=v%3Achat`);
    expect(got).toEqual({ folder: one });
  });

  it('takes an older server’s whole tree as the tree', async () => {
    const tree = { folders: [{ id: 'v:chat', name: 'Chat', parent: '', root: true }], files: [], links: [] };
    const f = fakeFetch(() => json(200, tree));
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).virtualFolder('')).resolves.toEqual({ tree });
  });
});

describe('a picture at the screen’s size', () => {
  it('is the server’s sized copy when it says its size', async () => {
    const f = fakeFetch(() => raw(200, 'WEBP', { 'content-type': 'image/webp', 'x-thumb-px': '1600' }));
    const uri = await new WorkbenchClient(BASE, { fetch: f.fetch }).previewUri('f 1', 2400.4);
    expect(f.calls[0].url).toBe(`${BASE}/api/files/f%201/thumb?px=2400`);
    expect(uri).toMatch(/^data:image\/webp;base64,/);
  });

  it.each([
    ['an older server’s grid picture', raw(200, 'small', { 'content-type': 'image/webp' })],
    ['not a picture', json(404, { detail: 'no picture is made of this kind of file' })],
    ['a size it refuses', json(422, { detail: [] })],
  ])('is none for %s: the original is shown', async (_, res) => {
    const f = fakeFetch(() => res);
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).previewUri('f1', 1600)).resolves.toBeNull();
  });

  it('says a lost session', async () => {
    const gone = jest.fn();
    const f = fakeFetch(() => json(401, { detail: 'Sign in first.' }));
    await new WorkbenchClient(BASE, { fetch: f.fetch, onUnauthorized: gone }).previewUri('f1', 800);
    expect(gone).toHaveBeenCalled();
  });
});

describe('the conversation trash’s days', () => {
  it('follows the server once its trash was listed, and keeps the default otherwise', async () => {
    let days: string | undefined = '14';
    const f = fakeFetch(() => json(200, [], days ? { 'x-trash-days': days } : {}));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    expect(c.chatTrashDays).toBe(CHAT_TRASH_DAYS);
    await c.listChats('', 'live');
    expect(c.chatTrashDays).toBe(30);
    await c.listChats('', 'trash');
    expect(c.chatTrashDays).toBe(14);
    days = undefined;
    const older = new WorkbenchClient(BASE, { fetch: f.fetch });
    await older.listChats('', 'trash');
    expect(older.chatTrashDays).toBe(30);
    days = 'nonsense';
    await older.listChats('', 'trash');
    expect(older.chatTrashDays).toBe(30);
  });
});
