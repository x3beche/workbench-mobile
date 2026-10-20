/**
 * Which accounts the app keeps, which one is open, and who it is.
 *
 *   server  - no account yet, or one being added: which server
 *   login   - a Workbench server, sign-in required, nobody signed in (a new
 *             account, or the open one's session ended)
 *   app     - an account open (or a server without sign-in: local mode)
 *
 * Several accounts stay signed in at once (state/accounts.ts), each with its
 * own session sent only on its own requests. Switching opens another one:
 * the app's screens are drawn afresh for it (App.tsx keys them by the
 * account), so its streams close and nothing of the one before stays.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { WorkbenchClient, type ClientDeps } from '../api/client';
import type { AuthState, User } from '../api/types';
import * as prefs from '../storage/prefs';
import {
  addAccount,
  currentAccountId,
  loadAccounts,
  migrate,
  readSession,
  removeAccount,
  saveAccounts,
  setCurrentAccountId,
  type Account,
} from './accounts';

export type Phase = 'boot' | 'server' | 'login' | 'app';

interface Session {
  phase: Phase;
  server: string | null;
  client: WorkbenchClient | null;
  user: User | null;
  /** The account open (null while one is being added or before the first). */
  account: Account | null;
  accounts: Account[];
  /** An account is being added: the server and sign-in screens offer the way back. */
  adding: boolean;
  /** Why the app is on the server or login screen (a server down, a session ended). */
  notice: string | null;
  /** A server that answered as Workbench: on to sign-in (or into the app). */
  connect: (base: string, state: AuthState) => Promise<void>;
  /** Signed in on the server chosen: the account added (or brought back) and opened. */
  signedIn: (user: User, session?: string | null) => Promise<void>;
  /** The open account signed out and taken out of the app; another one opens, if any. */
  signOut: () => Promise<void>;
  changeServer: () => void;
  /** Open another account. */
  switchTo: (id: string) => Promise<void>;
  /** Sign one account out and take it out of the app; the others stay signed in. */
  remove: (id: string) => Promise<void>;
  /** Add another account: on to the server screen, with the way back. */
  addAnother: () => void;
  /** Back to the open account from adding one. */
  cancelAdd: () => void;
  /** A client for another account (its own session), e.g. for its picture in the switcher. */
  clientFor: (a: Account) => WorkbenchClient;
  /** A client for a server and a session, as the sign-in screen needs before an account exists. */
  clientWith: (server: string, session: string | null) => WorkbenchClient;
}

const Ctx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

export function SessionProvider({ children, deps }: { children: ReactNode; deps?: ClientDeps }) {
  const [phase, setPhase] = useState<Phase>('boot');
  const [server, setServer] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /** Each account's session, read from the secure store once. */
  const sessions = useRef<Record<string, string | null>>({});

  const account = useMemo(() => accounts.find((a) => a.id === accountId) ?? null, [accounts, accountId]);

  const client = useMemo(
    () =>
      server
        ? new WorkbenchClient(server, {
            ...deps,
            session,
            onUnauthorized: () => {
              // Only a request made while signed in gets here (the client
              // leaves /api/auth/* out), so this account's session did end.
              setUser(null);
              setNotice('Your session ended. Sign in again.');
              setPhase((p) => (p === 'app' ? 'login' : p));
            },
          })
        : null,
    [server, session, deps],
  );

  const clientWith = useCallback(
    (base: string, s: string | null) => new WorkbenchClient(base, { ...deps, session: s, onUnauthorized: undefined }),
    [deps],
  );
  const clientFor = useCallback(
    (a: Account) => clientWith(a.server, sessions.current[a.id] ?? null),
    [clientWith],
  );

  /** Open an account: its server and session, then ask the server whether it is still signed in. */
  const open = useCallback(
    async (a: Account, list: Account[]): Promise<void> => {
      const s = a.id in sessions.current ? sessions.current[a.id] : await readSession(a.id);
      sessions.current[a.id] = s;
      setAccountId(a.id);
      setServer(a.server);
      setSession(s);
      setAdding(false);
      setNotice(null);
      await setCurrentAccountId(a.id);
      await prefs.setCurrentServer(a.server);
      try {
        const state = await clientWith(a.server, s).authState();
        if (state.mode === 'off' || state.user) {
          const u = state.user ?? a.user;
          setUser(u);
          if (state.user && state.user.id === a.user?.id) {
            // Who it is now (a new name or picture), kept for the switcher.
            const next = list.map((x) => (x.id === a.id ? { ...x, user: state.user } : x));
            setAccounts(next);
            await saveAccounts(next);
          }
          setPhase('app');
        } else {
          setUser(null);
          setNotice('Your session ended. Sign in again.');
          setPhase('login');
        }
      } catch {
        // The server did not answer: the account opens as it was, and says so when it is used.
        setUser(a.user);
        setPhase('app');
      }
    },
    [clientWith],
  );

  useEffect(() => {
    let live = true;
    (async () => {
      await migrate(deps);
      const list = await loadAccounts();
      if (!live) return;
      setAccounts(list);
      const want = await currentAccountId();
      const a = list.find((x) => x.id === want) ?? list[0];
      if (a) {
        await open(a, list);
        return;
      }
      // No account: the last server (signed out there) asks for a sign-in, else choose one.
      const last = await prefs.currentServer();
      if (!last) {
        if (live) setPhase('server');
        return;
      }
      try {
        const state = await clientWith(last, null).authState();
        if (!live) return;
        setServer(last);
        setSession(null);
        if (state.mode === 'off') {
          const got = await addAccount(last, state.user, null, { local: true });
          setAccounts(got.accounts);
          await open(got.account, got.accounts);
        } else setPhase('login');
      } catch {
        if (!live) return;
        setNotice(`${last.replace(/^https?:\/\//, '')} did not answer. Try again, or choose another server.`);
        setPhase('server');
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at start
  }, [deps]);

  const connect = useCallback(
    async (base: string, state: AuthState) => {
      await prefs.rememberServer(base);
      await prefs.setCurrentServer(base);
      setNotice(null);
      if (state.mode === 'off') {
        const got = await addAccount(base, state.user, null, { local: true });
        setAccounts(got.accounts);
        sessions.current[got.account.id] = null;
        await open(got.account, got.accounts);
        return;
      }
      if (state.user) {
        // Signed in by the platform's cookie (a browser's, or an app of before): traded for a
        // session of the account's own where the server can, and the cookie signed out;
        // an older server keeps it, as an account of its cookie.
        const plain = clientWith(base, null);
        const s = await plain.appSession().catch(() => null);
        if (s) await plain.logout().catch(() => undefined);
        const got = await addAccount(base, state.user, s, s ? {} : { cookie: true });
        setAccounts(got.accounts);
        sessions.current[got.account.id] = s;
        await open(got.account, got.accounts);
        return;
      }
      setServer(base);
      setSession(null);
      setUser(null);
      setPhase('login');
    },
    [open, clientWith],
  );

  const signedIn = useCallback(
    async (u: User, s: string | null = null) => {
      if (!server) return;
      const got = await addAccount(server, u, s, s ? {} : { cookie: true });
      sessions.current[got.account.id] = s;
      setAccounts(got.accounts);
      setAccountId(got.account.id);
      setSession(s);
      setUser(u);
      setNotice(null);
      setAdding(false);
      setPhase('app');
    },
    [server],
  );

  const remove = useCallback(
    async (id: string) => {
      const next = await removeAccount(id, deps);
      delete sessions.current[id];
      setAccounts(next);
      if (id !== accountId) return;
      const other = next[0];
      if (other) {
        await open(other, next);
        return;
      }
      // The last one: sign-in again on the same server.
      setAccountId(null);
      setSession(null);
      setUser(null);
      setNotice(null);
      setPhase(server ? 'login' : 'server');
    },
    [deps, accountId, open, server],
  );

  const signOut = useCallback(async () => {
    if (accountId) await remove(accountId);
    else {
      setUser(null);
      setPhase('login');
    }
  }, [accountId, remove]);

  const switchTo = useCallback(
    async (id: string) => {
      const a = accounts.find((x) => x.id === id);
      if (a) await open(a, accounts);
    },
    [accounts, open],
  );

  const addAnother = useCallback(() => {
    setAdding(true);
    setNotice(null);
    setPhase('server');
  }, []);

  const cancelAdd = useCallback(() => {
    const a = accounts.find((x) => x.id === accountId) ?? accounts[0];
    setAdding(false);
    if (a) open(a, accounts);
  }, [accounts, accountId, open]);

  const changeServer = useCallback(() => {
    setNotice(null);
    setPhase('server');
  }, []);

  const value = useMemo<Session>(
    () => ({
      phase,
      server,
      client,
      user,
      account,
      accounts,
      adding,
      notice,
      connect,
      signedIn,
      signOut,
      changeServer,
      switchTo,
      remove,
      addAnother,
      cancelAdd,
      clientFor,
      clientWith,
    }),
    [
      phase,
      server,
      client,
      user,
      account,
      accounts,
      adding,
      notice,
      connect,
      signedIn,
      signOut,
      changeServer,
      switchTo,
      remove,
      addAnother,
      cancelAdd,
      clientFor,
      clientWith,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
