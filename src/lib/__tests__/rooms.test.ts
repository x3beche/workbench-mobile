import type { Room } from '../../api/types';
import { asChatMessage, knownRooms, ROOM_LABEL, roomSnippet, unread } from '../rooms';

function room(over: Partial<Room> = {}): Room {
  return {
    room: 'cad',
    count: 0,
    waiting: 0,
    urgent: 0,
    last: null,
    agent_at: [],
    ...over,
  };
}

describe('the rooms', () => {
  it('names them as the web app does', () => {
    expect(ROOM_LABEL.cad).toBe('3D Drawing');
    expect(ROOM_LABEL.pcb).toBe('PCB Design');
    expect(ROOM_LABEL.firmware).toBe('Firmware');
  });

  it('keeps the three rooms and drops anything else the server sends', () => {
    const got = knownRooms([room({ room: 'cad' }), { ...room(), room: 'notes' as never }]);
    expect(got.map((r) => r.room)).toEqual(['cad']);
  });

  it('takes a missing list for no rooms', () => {
    expect(knownRooms(null)).toEqual([]);
  });
});

describe('what is unread in a room', () => {
  const at = (iso: string) => iso;

  it('counts what the agent wrote after this phone last read it', () => {
    const r = room({
      agent_at: [at('2026-10-14T10:00:00Z'), at('2026-10-15T09:00:00Z'), at('2026-10-15T11:00:00Z')],
    });
    expect(unread(r, '2026-10-15T08:00:00Z')).toBe(2);
    expect(unread(r, '2026-10-15T11:30:00Z')).toBe(0);
  });

  it('counts everything for a room never read here', () => {
    const r = room({ agent_at: [at('2026-10-14T10:00:00Z'), at('2026-10-15T09:00:00Z')] });
    expect(unread(r, undefined)).toBe(2);
  });

  it('counts nothing when the agent never wrote in it', () => {
    expect(unread(room(), undefined)).toBe(0);
  });

  it('counts everything rather than nothing when what was remembered is unreadable', () => {
    expect(unread(room({ agent_at: [at('2026-10-14T10:00:00Z')] }), 'not a date')).toBe(1);
  });
});

describe('a room row', () => {
  it('reads the last line with who said it', () => {
    const line = { role: 'agent' as const, text: 'Not ac499b\n  received', at: '2026-10-15T10:00:00Z' };
    expect(roomSnippet(room({ last: line }))).toBe('agent: Not ac499b received');
  });

  it('names the person who said it when it was not the agent', () => {
    const line = { role: 'user' as const, text: 'widen the panel', at: '2026-10-15T10:00:00Z', by: 'Emirhan' };
    expect(roomSnippet(room({ last: line }))).toBe('Emirhan: widen the panel');
  });

  it('says so when nothing was ever said in the room', () => {
    expect(roomSnippet(room())).toBe('No messages yet');
    // The row under a room's name is the app's words too, not the server's.
    expect(roomSnippet(room(), 'tr')).toBe('Henüz mesaj yok');
    const noted = { role: 'agent' as const, text: 'noted', at: '2026-10-15T10:00:00Z' };
    expect(roomSnippet(room({ last: noted }), 'tr')).toBe('ajan: noted');
  });
});

describe('a room line', () => {
  it('is drawn as the chat draws a line', () => {
    expect(
      asChatMessage({ id: 'x', at: '2026-10-15T10:00:00Z', role: 'agent', text: 'done', by: { name: 'agent' } }),
    ).toEqual({
      id: 'x',
      at: '2026-10-15T10:00:00Z',
      role: 'assistant',
      content: 'done',
      by: { name: 'agent' },
    });
    expect(asChatMessage({ id: 'y', at: '2026-10-15T10:00:00Z', role: 'user', text: 'widen it' }).role).toBe('user');
  });
});
