/**
 * Several accounts at once (1.5.6): each one's session kept apart, sent only
 * for it; a switch opens the other with nothing of the first; one signed out
 * alone; the single cookie account of 1.5.5 and before carried over.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { fakeFetch, jsonResponse } from '../../api/__tests__/fakes';
import * as prefs from '../../storage/prefs';
import { readSession } from '../../storage/secrets';
import { addAccount, loadAccounts, migrate, removeAccount, upsert, type Account } from '../accounts';
import { SessionProvider, useSession } from '../session';

const A = 'https://a.example';
const B = 'https://b.example';
const ada = { id: 'u1', name: 'Ada', email: 'ada@a.example' };
const bo = { id: 'u2', name: 'Bo', email: 'bo@a.example' };
const cy = { id: 'u1', name: 'Cy', email: 'cy@b.example' };
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const header = (init: RequestInit) => (init.headers as Record<string, string> | undefined)?.['x-workbench-session'];

beforeEach(async () => {
  await AsyncStorage.clear();
  store.clear();
});

describe('keeping accounts', () => {
  it('keeps each session in the secure store under its own account, never in AsyncStorage', async () => {
    const one = await addAccount(A, ada, 'S-ada');
    const two = await addAccount(A, bo, 'S-bo');
    const three = await addAccount(B, cy, 'S-cy');
    expect(new Set([one.account.id, two.account.id, three.account.id]).size).toBe(3);
    expect(await readSession(one.account.id)).toBe('S-ada');
    expect(await readSession(two.account.id)).toBe('S-bo');
    expect(await readSession(three.account.id)).toBe('S-cy');
    const plain = JSON.stringify(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()));
    expect(plain).not.toMatch(/S-ada|S-bo|S-cy/);
    expect((await loadAccounts()).map((a) => a.user?.name)).toEqual(['Ada', 'Bo', 'Cy']);
  });

  it('signing the same person in again is the same account, with the new session', async () => {
    const first = await addAccount(A, ada, 'S-1');
    const again = await addAccount(A, { ...ada, name: 'Ada L.' }, 'S-2');
    expect(again.account.id).toBe(first.account.id);
    expect(await loadAccounts()).toHaveLength(1);
    expect(await readSession(first.account.id)).toBe('S-2');
  });

  it('one cookie account per server: a second takes its place (they would share the cookie)', () => {
    const list: Account[] = [{ id: 'x', server: A, user: ada, cookie: true }];
    const got = upsert(list, A, bo, { cookie: true });
    expect(got.list.map((a) => a.user?.name)).toEqual(['Bo']);
    expect(got.dropped.map((a) => a.id)).toEqual(['x']);
  });

  it('remembers per account, not per server: two accounts on one server do not share it', async () => {
    const one = (await addAccount(A, ada, 'S-ada')).account;
    const two = (await addAccount(A, bo, 'S-bo')).account;
    await prefs.setLastChat(one.id, 'c-ada');
    await prefs.setRoomSeen(one.id, 'pcb', '2026-10-20T00:00:00Z');
    expect(await prefs.lastChat(two.id)).toBeNull();
    expect(await prefs.roomsSeen(two.id)).toEqual({});
  });
});

describe('signing one account out', () => {
  it("ends that account's session on the server with its own session, and leaves the others", async () => {
    const one = (await addAccount(A, ada, 'S-ada')).account;
    const two = (await addAccount(A, bo, 'S-bo')).account;
    await prefs.setLastChat(one.id, 'c-ada');
    const f = fakeFetch(() => jsonResponse(200, { signed_out: true }));
    const left = await removeAccount(one.id, { fetch: f.fetch });
    expect(left.map((a) => a.id)).toEqual([two.id]);
    expect(f.calls.map((c) => c.url)).toEqual([`${A}/api/auth/logout`]);
    expect(header(f.calls[0].init)).toBe('S-ada');
    expect(await readSession(one.id)).toBeNull();
    expect(await readSession(two.id)).toBe('S-bo');
    expect(await prefs.lastChat(one.id)).toBeNull();
  });

  it('is taken off the phone even when its server cannot be reached', async () => {
    const one = (await addAccount(A, ada, 'S-ada')).account;
    const left = await removeAccount(one.id, {
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    expect(left).toEqual([]);
    expect(await readSession(one.id)).toBeNull();
  });
});

describe('the account of 1.5.5 and before', () => {
  it('trades its cookie for an app session, signs the cookie out, and keeps what was remembered', async () => {
    await prefs.setCurrentServer(A);
    await prefs.setLastChat(A, 'c-old');
    await prefs.setRoomSeen(A, 'cad', '2026-10-19T00:00:00Z');
    const f = fakeFetch((url) => {
      if (url.endsWith('/api/auth/state')) return jsonResponse(200, { mode: 'on', user: ada, role: 'user' });
      if (url.endsWith('/api/auth/app-session')) return jsonResponse(200, { session: 'S-new' });
      return jsonResponse(200, { signed_out: true });
    });
    const made = await migrate({ fetch: f.fetch });
    expect(made?.user?.name).toBe('Ada');
    expect(made?.cookie).toBeUndefined();
    expect(await readSession(made!.id)).toBe('S-new');
    // The trade and the sign-out went with the cookie, never with a session header.
    expect(f.calls.map((c) => c.url.slice(A.length))).toEqual(['/api/auth/state', '/api/auth/app-session', '/api/auth/logout']);
    expect(f.calls.every((c) => header(c.init) === undefined)).toBe(true);
    expect(await prefs.lastChat(made!.id)).toBe('c-old');
    expect(await prefs.roomsSeen(made!.id)).toEqual({ cad: '2026-10-19T00:00:00Z' });
    // Done once.
    expect(await migrate({ fetch: f.fetch })).toBeNull();
  });

  it('keeps the cookie on a server without app sessions', async () => {
    await prefs.setCurrentServer(A);
    const f = fakeFetch((url) =>
      url.endsWith('/api/auth/state')
        ? jsonResponse(200, { mode: 'on', user: ada, role: 'user' })
        : jsonResponse(404, { detail: 'Not Found' }),
    );
    const made = await migrate({ fetch: f.fetch });
    expect(made?.cookie).toBe(true);
    expect(f.calls.some((c) => c.url.endsWith('/api/auth/logout'))).toBe(false);
  });

  it('carries nothing over when nobody was signed in, and tries again when the server did not answer', async () => {
    await prefs.setCurrentServer(A);
    const out = fakeFetch(() => jsonResponse(200, { mode: 'on', user: null }));
    expect(await migrate({ fetch: out.fetch })).toBeNull();
    const down = await migrate({
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    expect(down).toBeNull();
    expect(await loadAccounts()).toEqual([]);
  });
});

function Shown() {
  const { phase, user, server, accounts, account, switchTo, client } = useSession();
  return (
    <View>
      <Text testID="who">{`${phase} ${user?.name ?? '-'} @ ${server ?? '-'}`}</Text>
      {accounts.map((a) => (
        <Pressable key={a.id} testID={`to-${a.user?.name}`} onPress={() => switchTo(a.id)}>
          <Text>{a.id === account?.id ? `[${a.user?.name}]` : a.user?.name}</Text>
        </Pressable>
      ))}
      <Pressable testID="ask" onPress={() => client?.listChats().catch(() => undefined)} />
    </View>
  );
}

describe('switching', () => {
  it('opens the account left open, and a switch sends the other account its own session only', async () => {
    const one = (await addAccount(A, ada, 'S-ada')).account;
    await addAccount(B, cy, 'S-cy');
    await AsyncStorage.setItem('workbench.currentAccount', one.id);
    const f = fakeFetch((url, init) => {
      if (url.endsWith('/api/auth/state')) {
        const s = header(init);
        return jsonResponse(200, { mode: 'on', user: s === 'S-ada' ? ada : s === 'S-cy' ? cy : null, role: 'user' });
      }
      return jsonResponse(200, []);
    });
    await render(
      <SessionProvider deps={{ fetch: f.fetch }}>
        <Shown />
      </SessionProvider>,
    );
    expect(await screen.findByText(`app Ada @ ${A}`)).toBeTruthy();
    expect(screen.getByText('[Ada]')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('to-Cy'));
    expect(await screen.findByText(`app Cy @ ${B}`)).toBeTruthy();
    f.calls.length = 0;
    await fireEvent.press(screen.getByTestId('ask'));
    await act(async () => undefined);
    expect(f.calls.map((c) => [c.url.slice(0, B.length), header(c.init)])).toEqual([[B, 'S-cy']]);
    expect(await AsyncStorage.getItem('workbench.currentAccount')).not.toBe(one.id);
  });

  it("asks the open account to sign in again when its session ended, keeping the others", async () => {
    const one = (await addAccount(A, ada, 'S-dead')).account;
    await addAccount(B, cy, 'S-cy');
    await AsyncStorage.setItem('workbench.currentAccount', one.id);
    const f = fakeFetch(() => jsonResponse(200, { mode: 'on', user: null }));
    await render(
      <SessionProvider deps={{ fetch: f.fetch }}>
        <Shown />
      </SessionProvider>,
    );
    expect(await screen.findByText(`login - @ ${A}`)).toBeTruthy();
    expect(await loadAccounts()).toHaveLength(2);
  });
});
