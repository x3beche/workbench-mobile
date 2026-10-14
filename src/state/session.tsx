/**
 * Which server the app is on and who is signed in there.
 *
 *   server  - no server chosen yet (or the person chose to change it)
 *   login   - a Workbench server, sign-in required, nobody signed in
 *   app     - signed in (or the server runs without sign-in: local mode)
 *
 * The last server is remembered, so the app opens straight into it; whether
 * the session is still good is asked of the server (GET /api/auth/state).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { WorkbenchClient, type ClientDeps } from '../api/client';
import type { AuthState, User } from '../api/types';
import * as prefs from '../storage/prefs';

export type Phase = 'boot' | 'server' | 'login' | 'app';

interface Session {
  phase: Phase;
  server: string | null;
  client: WorkbenchClient | null;
  user: User | null;
  /** Why the app is on the server or login screen (a server down, a session ended). */
  notice: string | null;
  /** A server that answered as Workbench: on to sign-in (or into the app). */
  connect: (base: string, state: AuthState) => Promise<void>;
  signedIn: (user: User) => void;
  signOut: () => Promise<void>;
  changeServer: () => void;
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
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const client = useMemo(
    () =>
      server
        ? new WorkbenchClient(server, {
            ...deps,
            onUnauthorized: () => {
              // Only a request made while signed in gets here (the client
              // leaves /api/auth/* out), so the session did end.
              setUser(null);
              setNotice('Your session ended. Sign in again.');
              setPhase((p) => (p === 'app' ? 'login' : p));
            },
          })
        : null,
    [server, deps],
  );

  useEffect(() => {
    let live = true;
    (async () => {
      const last = await prefs.currentServer();
      if (!last) {
        if (live) setPhase('server');
        return;
      }
      try {
        const state = await new WorkbenchClient(last, deps).authState();
        if (!live) return;
        setServer(last);
        if (state.mode === 'off' || state.user) {
          setUser(state.user);
          setPhase('app');
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
  }, [deps]);

  const connect = useCallback(async (base: string, state: AuthState) => {
    await prefs.rememberServer(base);
    await prefs.setCurrentServer(base);
    setServer(base);
    setNotice(null);
    if (state.mode === 'off' || state.user) {
      setUser(state.user);
      setPhase('app');
    } else {
      setUser(null);
      setPhase('login');
    }
  }, []);

  const signedIn = useCallback((u: User) => {
    setUser(u);
    setNotice(null);
    setPhase('app');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await client?.logout();
    } catch {
      // Signed out here all the same: the server ends the session when it next can.
    }
    setUser(null);
    setNotice(null);
    setPhase('login');
  }, [client]);

  const changeServer = useCallback(() => {
    setNotice(null);
    setPhase('server');
  }, []);

  const value = useMemo<Session>(
    () => ({ phase, server, client, user, notice, connect, signedIn, signOut, changeServer }),
    [phase, server, client, user, notice, connect, signedIn, signOut, changeServer],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
