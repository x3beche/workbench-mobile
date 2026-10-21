/**
 * The open account's live streams (the web app's bus.ts and s2live.ts): one
 * per account, made when it opens and closed with it (App.tsx draws each
 * account afresh), so only the account on screen reads anything.
 *
 * - The account's event bus `acct/<account>/bus` (backend/bus.py): one live
 *   read shared by every screen that listens by kind (`on`). Besides the
 *   server's kinds every listener hears two of the app's own: `$open` - the
 *   read is open (again): what changed meanwhile was not heard, so read your
 *   piece once; `$down` - it closed: poll as before until it opens.
 * - Other streams (`activity`, `orch`, `chat-<id>`) through `follow`, on the
 *   same token.
 * - In the background every read is closed; back in the front each goes on
 *   from the record after the last one it had.
 *
 * A screen keeps its polling as the fallback: while the bus is up it polls
 * only as a slow safety net (`pace`) and reacts to its events instead.
 */
import { AppState, type AppStateStatus } from 'react-native';

import type { WorkbenchClient } from '../api/client';
import type { BusEvent } from '../api/types';
import { S2Follow, type S2FollowOpts } from './s2';

/** How long a poller rests while the bus is up: its safety net. */
export const BUS_SAFETY_MS = 60_000;

export type BusFn = (e: BusEvent) => void;

/** What the hub does with a follower, whatever it reads. */
interface Follower {
  stop(): void;
  pause(): void;
  resume(): void;
}

/** What the hub needs of AppState (a test hands its own). */
export interface AppStateLike {
  currentState?: AppStateStatus | string | null;
  addEventListener(type: 'change', fn: (s: AppStateStatus) => void): { remove(): void };
}

export class LiveHub {
  private subs = new Map<string, Set<BusFn>>();
  private all = new Set<BusFn>();
  private liveFns = new Set<(live: boolean) => void>();
  private followers = new Set<Follower>();
  private busOn = false;
  private busLive = false;
  private front: boolean;
  private appSub: { remove(): void } | null;
  private bus: S2Follow<BusEvent>;
  private disposed = false;

  constructor(
    readonly client: WorkbenchClient,
    appState: AppStateLike | null = AppState,
  ) {
    const st = appState?.currentState;
    this.front = !st || st === 'active';
    this.appSub =
      appState?.addEventListener('change', (s) => {
        const front = s === 'active';
        if (front === this.front) return;
        this.front = front;
        for (const f of this.followers) {
          if (front) f.resume();
          else f.pause();
        }
      }) ?? null;
    this.bus = this.follow<BusEvent>((e) => this.deliver(e), {
      stream: 'bus',
      every: true,
      fromTail: true,
      onOpen: () => this.say('$open'),
      onLive: (l) => {
        const was = this.busLive;
        this.busLive = l;
        if (was && !l) this.say('$down');
        for (const fn of [...this.liveFns]) {
          try {
            fn(l);
          } catch {
            // the caller's
          }
        }
      },
    });
  }

  /** The bus is up: events arrive as things change. */
  live(): boolean {
    return this.busLive;
  }

  /** Told when the bus goes up or down. */
  onLive(fn: (live: boolean) => void): () => void {
    this.liveFns.add(fn);
    return () => this.liveFns.delete(fn);
  }

  /** Hear these kinds (and `$open` / `$down`); the returned function stops it. */
  on(kinds: string | string[], fn: BusFn): () => void {
    const ks = Array.isArray(kinds) ? kinds : [kinds];
    for (const k of ks) {
      let s = this.subs.get(k);
      if (!s) this.subs.set(k, (s = new Set()));
      s.add(fn);
    }
    this.all.add(fn);
    this.run();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      for (const k of ks) this.subs.get(k)?.delete(fn);
      this.all.delete(fn);
      this.run();
    };
  }

  /** Another stream of the account's, read while the app is in the front. Start and stop it yourself. */
  follow<T>(onRecord: (v: T) => void, opts: S2FollowOpts = {}): S2Follow<T> {
    const f = new S2Follow<T>(this.client, onRecord, { ...opts, awake: () => this.front && !this.disposed });
    this.followers.add(f);
    return f;
  }

  /** A follower no longer wanted: stopped and let go. */
  drop(f: Follower | null | undefined): void {
    if (!f || f === this.bus) return;
    f.stop();
    this.followers.delete(f);
  }

  /** A poller's pace: `due()` says whether this tick should read. */
  pace(safetyMs = BUS_SAFETY_MS): BusPace {
    return new BusPace(this, safetyMs);
  }

  /** Every read closed for good (the account closed). */
  dispose(): void {
    this.disposed = true;
    this.appSub?.remove();
    this.appSub = null;
    for (const f of this.followers) f.stop();
    this.followers.clear();
    this.subs.clear();
    this.all.clear();
    this.liveFns.clear();
  }

  private run(): void {
    const want = this.all.size > 0 && !this.disposed;
    if (want === this.busOn) return;
    this.busOn = want;
    if (want) this.bus.start();
    else this.bus.stop();
  }

  private deliver(e: BusEvent): void {
    if (!e || typeof e.k !== 'string') return;
    for (const fn of [...(this.subs.get(e.k) ?? [])]) {
      try {
        fn(e);
      } catch {
        // one screen's trouble is its own
      }
    }
  }

  private say(k: '$open' | '$down'): void {
    for (const fn of [...this.all]) {
      try {
        fn({ k });
      } catch {
        // one screen's trouble is its own
      }
    }
  }
}

/** For a screen that polls on a timer: while the bus is up, a tick reads only once the safety net has passed. */
export class BusPace {
  private at = 0;
  constructor(
    private readonly hub: { live(): boolean },
    private readonly safetyMs: number,
  ) {}

  due(): boolean {
    const n = Date.now();
    if (this.hub.live() && n - this.at < this.safetyMs) return false;
    this.at = n;
    return true;
  }

  /** A read made for another reason (an event): the net starts over. */
  mark(): void {
    this.at = Date.now();
  }
}
