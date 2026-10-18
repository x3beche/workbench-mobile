/**
 * What the app remembers on the device: the last few servers, the address
 * last signed in with on each, the voice language and when its words
 * appear, and the conversation last open on each. Never a password or a
 * session - the session is a cookie the platform keeps.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { VoiceLang } from '../api/client';
import type { VoiceMode } from '../voice/voice';

export const MAX_SERVERS = 5;
const SERVERS = 'workbench.servers';
const EMAILS = 'workbench.emails';
const CURRENT = 'workbench.current';
const VOICE_LANG = 'workbench.voiceLang';
const VOICE_MODE = 'workbench.voiceMode';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the app works on, it forgets instead.
  }
}

/** The list with `server` first, no duplicates, at most MAX_SERVERS long. */
export function withServerFirst(list: string[], server: string): string[] {
  return [server, ...list.filter((s) => s !== server)].slice(0, MAX_SERVERS);
}

export async function recentServers(): Promise<string[]> {
  const got = await readJson<unknown>(SERVERS, []);
  return Array.isArray(got) ? got.filter((s): s is string => typeof s === 'string').slice(0, MAX_SERVERS) : [];
}

export async function rememberServer(server: string): Promise<string[]> {
  const next = withServerFirst(await recentServers(), server);
  await writeJson(SERVERS, next);
  return next;
}

export async function forgetServer(server: string): Promise<string[]> {
  const next = (await recentServers()).filter((s) => s !== server);
  await writeJson(SERVERS, next);
  const current = await currentServer();
  if (current === server) await setCurrentServer(null);
  return next;
}

/** The server the app was last on, to open straight into it. */
export async function currentServer(): Promise<string | null> {
  return readJson<string | null>(CURRENT, null);
}

export async function setCurrentServer(server: string | null): Promise<void> {
  if (server === null) {
    try {
      await AsyncStorage.removeItem(CURRENT);
    } catch {
      /* nothing to forget */
    }
    return;
  }
  await writeJson(CURRENT, server);
}

export async function lastEmail(server: string): Promise<string> {
  const all = await readJson<Record<string, string>>(EMAILS, {});
  return typeof all[server] === 'string' ? all[server] : '';
}

export async function rememberEmail(server: string, email: string): Promise<void> {
  const all = await readJson<Record<string, string>>(EMAILS, {});
  all[server] = email;
  await writeJson(EMAILS, all);
}

export async function voiceLang(): Promise<VoiceLang> {
  const got = await readJson<string>(VOICE_LANG, 'auto');
  return got === 'tr' || got === 'en' ? got : 'auto';
}

export async function setVoiceLang(lang: VoiceLang): Promise<void> {
  await writeJson(VOICE_LANG, lang);
}

/** Words while speaking (the default) or after recording. */
export async function voiceMode(): Promise<VoiceMode> {
  const got = await readJson<string>(VOICE_MODE, 'live');
  return got === 'record' ? 'record' : 'live';
}

export async function setVoiceMode(mode: VoiceMode): Promise<void> {
  await writeJson(VOICE_MODE, mode);
}

const LAST_CHAT = 'workbench.lastChat';

/** The conversation last open on `server`, to open straight into it (null: a new one). */
export async function lastChat(server: string): Promise<string | null> {
  const all = await readJson<Record<string, string>>(LAST_CHAT, {});
  return typeof all[server] === 'string' ? all[server] : null;
}

export async function setLastChat(server: string, id: string | null): Promise<void> {
  const all = await readJson<Record<string, string>>(LAST_CHAT, {});
  if (id) all[server] = id;
  else delete all[server];
  await writeJson(LAST_CHAT, all);
}

const ROOM_SEEN = 'workbench.roomSeen';

/** When each room was last read here, on `server`, keyed by the room's own name. */
export async function roomsSeen(server: string): Promise<Record<string, string>> {
  const all = await readJson<Record<string, Record<string, string>>>(ROOM_SEEN, {});
  const mine = all[server];
  return mine && typeof mine === 'object' ? mine : {};
}

/** A room was read now: what the agent writes after this is what is unread. */
export async function setRoomSeen(server: string, room: string, at: string): Promise<void> {
  const all = await readJson<Record<string, Record<string, string>>>(ROOM_SEEN, {});
  all[server] = { ...(all[server] ?? {}), [room]: at };
  await writeJson(ROOM_SEEN, all);
}
