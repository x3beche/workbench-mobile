import { CSRF_HEADER, WorkbenchClient } from '../client';
import { fakeFetch, jsonResponse } from './fakes';

const BASE = 'https://wb.example';

/** FileReader as React Native and browsers have it (Node has none). */
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
const headersOf = (init: RequestInit) => (init.headers ?? {}) as Record<string, string>;

/** A response with any headers and a body that can be read as a Blob. */
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

describe('conversations: archive, pins and the trash', () => {
  it('lists the live ones, the archived ones or the trash, with what was searched', async () => {
    const f = fakeFetch(() => jsonResponse(200, []));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.listChats();
    await c.listChats('', 'archived');
    await c.listChats(' rail ', 'trash');
    expect(f.calls.map((x) => x.url)).toEqual([
      `${BASE}/api/cc/chats?archived=0`,
      `${BASE}/api/cc/chats?archived=1`,
      `${BASE}/api/cc/chats?trash=1&q=rail`,
    ]);
  });

  it('pins, archives and unarchives with PATCH', async () => {
    const f = fakeFetch(() => jsonResponse(200, { id: 'c1' }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.pin('c1', true);
    await c.archive('c1');
    await c.archive('c1', false);
    expect(f.calls.map((x) => [x.init.method, JSON.parse(x.init.body as string)])).toEqual([
      ['PATCH', { pinned: true }],
      ['PATCH', { archived: true }],
      ['PATCH', { archived: false }],
    ]);
    for (const { init } of f.calls) expect(headersOf(init)[CSRF_HEADER]).toBe('1');
  });

  it('restores from the trash, deletes forever and empties the trash', async () => {
    const f = fakeFetch(() => jsonResponse(200, { deleted: 0, kept: 0 }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.restoreChat('c 1');
    await c.removeForever('c1');
    await c.emptyTrash();
    expect(f.calls.map((x) => `${x.init.method} ${x.url}`)).toEqual([
      `POST ${BASE}/api/cc/chats/c%201/restore`,
      `DELETE ${BASE}/api/cc/chats/c1?forever=1`,
      `POST ${BASE}/api/cc/chats/empty-trash`,
    ]);
  });
});

describe('files', () => {
  it('reads My files, the folders, the read-only tree and the trash', async () => {
    const f = fakeFetch(() => jsonResponse(200, []));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.listFiles();
    await c.folders();
    await c.virtualTree();
    await c.filesTrash();
    expect(f.calls.map((x) => x.url.replace(BASE, ''))).toEqual([
      '/api/files',
      '/api/files/folders',
      '/api/files/virtual',
      '/api/files/trash',
    ]);
  });

  it('renames, moves, deletes, copies to My files, restores and purges as the web app does', async () => {
    const f = fakeFetch(() => jsonResponse(200, {}));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await c.renameFile('f1', ' new.pdf ');
    await c.moveFiles(['f1'], [], 'd2');
    await c.deleteFile('f1');
    await c.copyToMine('v:ms:abc', 'd2');
    await c.restoreFiles(['f1']);
    await c.purgeFiles(['f2']);
    await c.makeFolder('Datasheets', '');
    await c.renameFolder('d1', 'Specs');
    await c.deleteFolder('d1', true);
    expect(f.calls.map((x) => `${x.init.method} ${x.url.replace(BASE, '')} ${x.init.body ?? ''}`.trim())).toEqual([
      'PATCH /api/files/f1 {"name":"new.pdf"}',
      'POST /api/files/move {"files":["f1"],"folders":[],"to":"d2"}',
      'DELETE /api/files/f1',
      'POST /api/files/v%3Ams%3Aabc/copy {"folder":"d2"}',
      'POST /api/files/trash/restore {"files":["f1"]}',
      'POST /api/files/trash/purge {"files":["f2"]}',
      'POST /api/files/folders {"name":"Datasheets","parent":""}',
      'PATCH /api/files/folders/d1 {"name":"Specs"}',
      'DELETE /api/files/folders/d1?contents=true',
    ]);
  });

  it('throws the server’s own words when it refuses', async () => {
    const f = fakeFetch(() => jsonResponse(403, { detail: 'as viewer you cannot delete' }));
    await expect(new WorkbenchClient(BASE, { fetch: f.fetch }).deleteFile('f1')).rejects.toThrow(
      'as viewer you cannot delete',
    );
  });

  describe('upload', () => {
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

    it('sends each file as an `upload` part, into the folder open', async () => {
      const f = fakeFetch(() => jsonResponse(200, [{ id: 'f9', name: 'a.jpg' }]));
      const blob = { size: 1 } as unknown as Blob;
      const got = await new WorkbenchClient(BASE, { fetch: f.fetch }).upload(
        [
          { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' },
          { blob, name: 'b.txt' },
        ],
        'd1',
      );
      expect(got).toEqual([{ id: 'f9', name: 'a.jpg' }]);
      const { url, init } = f.calls[0];
      expect(url).toBe(`${BASE}/api/files`);
      expect(init.method).toBe('POST');
      expect(headersOf(init)[CSRF_HEADER]).toBe('1');
      expect(headersOf(init)['Content-Type']).toBeUndefined();
      expect((init.body as unknown as FakeForm).parts).toEqual([
        ['upload', { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' }, undefined],
        ['upload', blob, 'b.txt'],
        ['context', '{"room":"files"}', undefined],
        ['note', '', undefined],
        ['folder', 'd1', undefined],
      ]);
    });

    it('says why an upload was refused', async () => {
      const f = fakeFetch(() => jsonResponse(413, { detail: 'a.zip: larger than 200 MB' }));
      await expect(
        new WorkbenchClient(BASE, { fetch: f.fetch }).upload([{ uri: 'u', name: 'a.zip', type: 'x' }], ''),
      ).rejects.toThrow('a.zip: larger than 200 MB');
    });
  });

  it('reads a small picture: ready as a data URI, later on 202, none on 404', async () => {
    const answers = [
      raw(200, 'RIFF', { 'content-type': 'image/webp' }),
      raw(202, '{"state":"making"}', { 'retry-after': '8' }),
      raw(202, '{"state":"busy"}'),
      raw(404, '{"detail":"no picture"}'),
    ];
    const f = fakeFetch(() => answers.shift()!);
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    const ready = await c.mini('f1');
    expect(ready.state).toBe('ready');
    expect(ready.state === 'ready' && ready.uri.startsWith('data:image/webp;base64,')).toBe(true);
    await expect(c.mini('f1')).resolves.toEqual({ state: 'later', seconds: 8 });
    await expect(c.mini('f1')).resolves.toEqual({ state: 'later', seconds: 2 });
    await expect(c.mini('f1')).resolves.toEqual({ state: 'none' });
    expect(f.calls[0].url).toBe(`${BASE}/api/files/f1/mini?wait=1.5`);
    expect(f.calls[0].init.credentials).toBe('include');
  });

  it('reads the first part of a text with a Range request, and says when there is more', async () => {
    const answers = [raw(206, 'hello', { 'content-range': 'bytes 0-4/900' }), raw(200, 'all of it')];
    const f = fakeFetch(() => answers.shift()!);
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await expect(c.fileText('f1', 5)).resolves.toEqual({ text: 'hello', cut: true });
    await expect(c.fileText('f1', 5)).resolves.toEqual({ text: 'all of it', cut: false });
    expect(f.calls[0].url).toBe(`${BASE}/api/files/f1?inline=1`);
    expect(headersOf(f.calls[0].init).Range).toBe('bytes=0-4');
  });

  it('asks a PDF for its page count and draws pages by address', async () => {
    const f = fakeFetch(() => jsonResponse(200, { count: 12, pages: [] }));
    const c = new WorkbenchClient(BASE, { fetch: f.fetch });
    await expect(c.pdfPages('f1')).resolves.toBe(12);
    expect(f.calls[0].url).toBe(`${BASE}/api/files/f1/pdf?pages=1`);
    expect(c.pdfPageUrl('f1', 3)).toBe(`${BASE}/api/files/f1/pdf/page/3.png?dpi=110`);
    expect(c.fileUrl('a b', true)).toBe(`${BASE}/api/files/a%20b?inline=1`);
  });
});
