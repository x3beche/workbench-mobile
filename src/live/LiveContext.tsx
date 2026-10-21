/**
 * The open account's LiveHub for the screens (live/hub.ts): made with the
 * account's client, closed when the account closes. Screens without one (a
 * test, a server screen) simply poll.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { WorkbenchClient } from '../api/client';
import type { BusEvent } from '../api/types';
import { LiveHub } from './hub';

/** The hub of the open account (exported for tests, which hand their own). */
export const LiveContext = createContext<LiveHub | null>(null);
const Ctx = LiveContext;

export function LiveProvider({ client, children }: { client: WorkbenchClient | null; children: ReactNode }) {
  const hub = useMemo(() => (client ? new LiveHub(client) : null), [client]);
  useEffect(() => () => hub?.dispose(), [hub]);
  return <Ctx.Provider value={hub}>{children}</Ctx.Provider>;
}

/** The open account's hub, or null (no streams: poll). */
export function useLive(): LiveHub | null {
  return useContext(Ctx);
}

/**
 * Hear these kinds of the bus (and `$open` / `$down`) while mounted; `fn`
 * may change from render to render. Nothing without a hub, or when `on` is false.
 */
export function useBus(kinds: string[], fn: (e: BusEvent) => void, on = true): void {
  const hub = useLive();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  const key = kinds.join(',');
  useEffect(() => {
    if (!hub || !on) return;
    return hub.on(key.split(','), (e) => ref.current(e));
  }, [hub, key, on]);
}

/** Whether the bus is up now (events arrive), redrawn as it changes. */
export function useBusLive(): boolean {
  const hub = useLive();
  const [live, setLive] = useState(() => hub?.live() ?? false);
  useEffect(() => (hub ? hub.onLive(setLive) : undefined), [hub]);
  return live;
}
