/**
 * The workspace's three rooms, as the app shows them: 3D Drawing, PCB Design
 * and Firmware (backend/chat.py ROOMS). Each has the agent working in it, and
 * a thread of its own, next to the conversations.
 */
import type { Room, RoomId } from '../api/types';
import { Box, CircuitBoard, Cpu } from '../components/icons';
import type { UiLang } from '../update/strings';

/** What each room is about, in the words the web app uses. */
export const ROOM_LABEL: Record<RoomId, string> = {
  cad: '3D Drawing',
  pcb: 'PCB Design',
  firmware: 'Firmware',
};

/** The room's name in the app's language (the web's own words for them). */
export function roomName(room: RoomId, lang: UiLang): string {
  if (lang !== 'tr') return ROOM_LABEL[room];
  const tr: Record<RoomId, string> = { cad: '3B Çizim', pcb: 'PCB Tasarım', firmware: 'Gömülü Yazılım' };
  return tr[room] ?? ROOM_LABEL[room];
}

/** The room's icon, the same family the web app draws them with. */
export const ROOM_ICON = { cad: Box, pcb: CircuitBoard, firmware: Cpu };

/** The rooms the server sent, with anything this app does not know left out. */
export function knownRooms(rooms: Room[] | null): Room[] {
  return (rooms ?? []).filter((r) => r && r.room in ROOM_LABEL);
}

/**
 * How many lines the agent wrote in a room since it was last read here. A
 * room never opened here counts everything the agent wrote in it: it has
 * not been read on this phone yet.
 */
export function unread(room: Room, seen: string | undefined): number {
  const wrote = room.agent_at ?? [];
  if (!seen) return wrote.length;
  const at = Date.parse(seen);
  if (Number.isNaN(at)) return wrote.length;
  return wrote.filter((iso) => {
    const t = Date.parse(iso);
    return !Number.isNaN(t) && t > at;
  }).length;
}

/** One line of a room, as the row under its name reads it. */
export function roomSnippet(room: Room): string {
  const last = room.last;
  if (!last) return 'No messages yet';
  const who = last.role === 'agent' ? 'agent' : last.by || 'you';
  const text = last.text.replace(/\s+/g, ' ').trim();
  return `${who}: ${text}`;
}

/** A line of a room as the chat's own line, so it is drawn the same way. */
export function asChatMessage(line: {
  id: string;
  at: string;
  role: 'user' | 'agent';
  text: string;
  by?: { id?: string; name?: string; type?: string };
}) {
  return {
    id: line.id,
    at: line.at,
    role: (line.role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: line.text,
    by: line.by,
  };
}
