/** The rooms as the client reads and writes them (backend/chat.py). */
import { CSRF_HEADER, WorkbenchClient } from '../client';
import { fakeFetch, jsonResponse } from './fakes';

const BASE = 'https://wb.example';

const ROOMS = [
  {
    room: 'cad',
    count: 4,
    waiting: 0,
    urgent: 0,
    last: { role: 'agent', text: 'Not ac499b received', at: '2026-10-15T10:00:00Z', by: null },
    agent_at: ['2026-10-14T10:00:00Z', '2026-10-15T10:00:00Z'],
  },
  { room: 'pcb', count: 1, waiting: 0, urgent: 0, last: null, agent_at: [] },
  { room: 'firmware', count: 0, waiting: 0, urgent: 0, last: null, agent_at: [] },
];

describe('the agent rooms', () => {
  it('reads the three of them', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, ROOMS));
    const client = new WorkbenchClient(BASE, { fetch });
    const got = await client.rooms();
    expect(calls[0].url).toBe(`${BASE}/api/chat/rooms`);
    expect(calls[0].init.method).toBe('GET');
    expect(got.map((r) => r.room)).toEqual(['cad', 'pcb', 'firmware']);
    expect(got[0].agent_at).toHaveLength(2);
  });

  it("reads one room's thread, that room's only", async () => {
    const { fetch, calls } = fakeFetch((url) =>
      jsonResponse(200, url.includes('room=pcb') ? [{ id: 'l1', at: '2026-10-15T10:00:00Z', role: 'agent', text: 'CN1 stays 2-pin' }] : []),
    );
    const client = new WorkbenchClient(BASE, { fetch });
    const got = await client.roomHistory('pcb');
    expect(calls[0].url).toBe(`${BASE}/api/chat?room=pcb`);
    expect(got).toHaveLength(1);
    expect(got[0].text).toBe('CN1 stays 2-pin');
  });

  it('takes the last few lines instead of all of them', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, []));
    await new WorkbenchClient(BASE, { fetch }).roomHistory('cad', 20);
    expect(calls[0].url).toBe(`${BASE}/api/chat?room=cad&limit=20`);
  });

  it('says something in a room, with the room on the line', async () => {
    const { fetch, calls } = fakeFetch(() =>
      jsonResponse(200, { id: 'l2', at: '2026-10-15T10:05:00Z', role: 'user', text: 'flash it', room: 'firmware' }),
    );
    const client = new WorkbenchClient(BASE, { fetch });
    const got = await client.sayRoom('firmware', 'flash it');
    expect(calls[0].url).toBe(`${BASE}/api/chat`);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ room: 'firmware', text: 'flash it', urgent: false });
    expect((calls[0].init.headers as Record<string, string>)[CSRF_HEADER]).toBe('1');
    expect(got.room).toBe('firmware');
  });

  it('can mark a line as urgent', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, {}));
    await new WorkbenchClient(BASE, { fetch }).sayRoom('cad', 'now', true);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ room: 'cad', text: 'now', urgent: true });
  });
});
