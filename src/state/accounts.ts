/**
 * The accounts the app keeps signed in at once - on one server or several -
 * and which one is open. Each is a row in AsyncStorage (its server, who it
 * is, a local id) and a session of its own in the secure store
 * (storage/secrets.ts), sent as X-Workbench-Session on its requests; nothing
 * of one account is ever sent for another.
 *
 * What the app remembers per account - the conversation open last, when
 * each room was read - is keyed by the account's id, so a switch shows
 * nothing of the account before.
 *
 * Before 1.5.6 the app had one account, signed in with the platform's
 * cookie: `migrate` turns it into the first account here, trading the
 * cookie for a session of the app's own where the server can
 * (POST /api/auth/app-session) and then signing the cookie out.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { WorkbenchClient, type ClientDeps } from '../api/client';
import type { User } from '../api/types';
import * as prefs from '../storage/prefs';
import { dropSession, readSession, writeSession } from '../storage/secrets';

const ACCOUNTS = 'workbench.accounts';
const CURRENT_ACCOUNT = 'workbench.currentAccount';
/** At most this many accounts are kept. */
export const MAX_ACCOUNTS = 8;

export interface Account {
  /** The app's own id for it: what its session and remembered state are kept under. */
  id: string;
  server: string;
  /** Who it is (null on a server without sign-in). */
  user: User | null;
  /** A server without sign-in: everyone is the owner there. */
  local?: boolean;
  /** Signed in with the platform's cookie: a server older than app sessions. One such account per server. */
  cookie?: boolean;
}

function clean(u: User | null): User | null {
  if (!u) return null;
  return { id: u.id, name: u.name ?? null, email: u.email, has_avatar: u.has_avatar, avatar_v: u.avatar_v ?? null };
}

export async function loadAccounts(): Promise<Account[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS);
    const got = raw ? JSON.parse(raw) : [];
    return Array.isArray(got)
      ? got.filter((a): a is Account => !!a && typeof a.id === 'string' && typeof a.server === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function saveAccounts(list: Account[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCOUNTS, JSON.stringify(list.slice(0, MAX_ACCOUNTS)));
  } catch {
    // Storage full or unavailable: the app works on and forgets.
  }
}

export async function currentAccountId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_ACCOUNT);
  } catch {
    return null;
  }
}

export async function setCurrentAccountId(id: string | null): Promise<void> {
  try {
    if (id) await AsyncStorage.setItem(CURRENT_ACCOUNT, id);
    else await AsyncStorage.removeItem(CURRENT_ACCOUNT);
  } catch {
    // Remembered next time.
  }
}

let seq = 0;
export function newAccountId(): string {
  seq = (seq + 1) % 1000;
  return `a${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The same person on the same server (or the same server without sign-in). */
export function sameAccount(a: Account, server: string, user: User | null, local: boolean): boolean {
  if (a.server !== server) return false;
  if (local || a.local) return !!local && !!a.local;
  return !!user && a.user?.id === user.id;
}

/**
 * The account for `server` and `user` put in the list: the one already there
 * (with who it is now), or a new one. A cookie account (an older server)
 * takes the place of any other cookie account on that server - they would
 * share the platform's one cookie.
 */
export function upsert(
  list: Account[],
  server: string,
  user: User | null,
  opts: { local?: boolean; cookie?: boolean } = {},
): { list: Account[]; account: Account; dropped: Account[] } {
  const local = !!opts.local;
  const found = list.find((a) => sameAccount(a, server, user, local));
  const account: Account = {
    id: found?.id ?? newAccountId(),
    server,
    user: clean(user),
    ...(local ? { local: true } : {}),
    ...(opts.cookie ? { cookie: true } : {}),
  };
  const dropped = opts.cookie ? list.filter((a) => a.id !== account.id && a.server === server && a.cookie) : [];
  const keep = list.filter((a) => !dropped.includes(a));
  const next = found ? keep.map((a) => (a.id === account.id ? account : a)) : [...keep, account];
  return { list: next, account, dropped };
}

/** An account and its session added (or brought up to date) and made the open one. */
export async function addAccount(
  server: string,
  user: User | null,
  session: string | null,
  opts: { local?: boolean; cookie?: boolean } = {},
): Promise<{ accounts: Account[]; account: Account }> {
  const { list, account, dropped } = upsert(await loadAccounts(), server, user, opts);
  for (const d of dropped) await forgetLocally(d.id);
  if (session) await writeSession(account.id, session);
  await saveAccounts(list);
  await setCurrentAccountId(account.id);
  return { accounts: list, account };
}

/** What the app kept for an account, gone: its session and its remembered state. */
async function forgetLocally(id: string): Promise<void> {
  await dropSession(id);
  await prefs.setLastChat(id, null);
  await prefs.forgetRoomsSeen(id);
}

/**
 * One account signed out and taken out of the app; the others stay signed
 * in. The server is told to end its session (with that account's own
 * session, never another's) when it can be reached.
 */
export async function removeAccount(id: string, deps: ClientDeps = {}): Promise<Account[]> {
  const list = await loadAccounts();
  const gone = list.find((a) => a.id === id);
  if (gone && !gone.local) {
    const session = await readSession(id);
    // A cookie account signs out with the cookie; one with a session of its own with that session only.
    if (session || gone.cookie) {
      await new WorkbenchClient(gone.server, { ...deps, session, onUnauthorized: undefined })
        .logout()
        .catch(() => undefined);
    }
  }
  await forgetLocally(id);
  const next = list.filter((a) => a.id !== id);
  await saveAccounts(next);
  if ((await currentAccountId()) === id) await setCurrentAccountId(next[0]?.id ?? null);
  return next;
}

export { readSession };

/**
 * The one account of an app before 1.5.6 (the last server, signed in by
 * cookie), made the first account here. Done once: nothing happens when
 * there are accounts already or no server was used. The server is asked who
 * is signed in; a server without sign-in becomes a local account; a signed-in
 * person's cookie is traded for an app session where the server offers one,
 * and the cookie then signed out, so it can never be sent for anyone else.
 * An older server keeps the cookie (a cookie account). Nobody signed in:
 * nothing to carry over. The server not answering: tried again next start.
 */
export async function migrate(deps: ClientDeps = {}): Promise<Account | null> {
  if ((await loadAccounts()).length) return null;
  const server = await prefs.currentServer();
  if (!server) return null;
  const plain = new WorkbenchClient(server, { ...deps, session: null, onUnauthorized: undefined });
  let state;
  try {
    state = await plain.authState();
  } catch {
    return null;
  }
  let made: Account | null = null;
  if (state.mode === 'off') {
    made = (await addAccount(server, state.user, null, { local: true })).account;
  } else if (state.user) {
    let session: string | null = null;
    try {
      session = await plain.appSession();
    } catch {
      session = null;
    }
    made = (await addAccount(server, state.user, session, session ? {} : { cookie: true })).account;
    // The cookie is not needed any more: signed out, so the jar holds nobody's session.
    if (session) await plain.logout().catch(() => undefined);
  }
  if (made) {
    // What was remembered for the server is this account's now.
    const last = await prefs.lastChat(server);
    if (last) await prefs.setLastChat(made.id, last);
    const seen = await prefs.roomsSeen(server);
    for (const [room, at] of Object.entries(seen)) await prefs.setRoomSeen(made.id, room, at);
  }
  return made;
}
