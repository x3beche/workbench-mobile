/** Renders the signed-out screens inside a real SessionProvider, the network faked by globalThis.fetch. */
import { Text } from 'react-native';

import { SessionProvider, useSession } from '../../state/session';
import { LoginScreen } from '../LoginScreen';
import { ServerScreen } from '../ServerScreen';

function Shown() {
  const { phase, user, server } = useSession();
  if (phase === 'server') return <ServerScreen />;
  if (phase === 'login') return <LoginScreen />;
  if (phase === 'app') return <Text testID="signed-in">{`${user?.name ?? 'local'} @ ${server}`}</Text>;
  return <Text testID="booting">booting</Text>;
}

export function Harness() {
  return (
    <SessionProvider>
      <Shown />
    </SessionProvider>
  );
}

export type Route = (url: string, init: RequestInit) => { status: number; body: unknown } | 'offline';

export function json(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => text,
  } as unknown as Response;
}

/** globalThis.fetch answering from `route`; returns the calls made. */
export function serve(route: Route) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = jest.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    const got = route(u, init);
    if (got === 'offline') throw new TypeError('Network request failed');
    return json(got.status, got.body);
  }) as unknown as typeof fetch;
  return calls;
}
