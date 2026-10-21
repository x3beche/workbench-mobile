/**
 * One live stream of the account's, read through the server's s2 gate
 * (backend/s2live.py, docker/s2gate; the web app's s2live.ts): records as
 * they are written, instead of asking the API again every few seconds.
 *
 * - A read token from POST /api/s2/token (short, for the account's own
 *   streams only), shared by every stream of that account and kept in memory
 *   only; then a live read (SSE) of <server>/s2/v1/streams/<stream>/records
 *   with the token in the Authorization header - never in an address, never
 *   written down - through the app's XMLHttpRequest reader (api/sse.ts):
 *   React Native's fetch has no readable body.
 * - The token is asked again a minute before it ends, and the read goes on
 *   from the record after the last one it had (seq_num). A refused or ended
 *   token is only a reason to ask for a new one: it never signs anyone out
 *   (api/client.ts leaves /api/s2/ out of the session's 401).
 * - `live()` is false while there is no stream: the caller polls as before.
 *   Failures back off (1 s, then 15 s doubling up to 5 min); a server
 *   without the token route is not asked again.
 * - Paused in the background (`pause`, LiveHub's AppState), opened again in
 *   the front (`resume`) from where it was.
 */
import { isMissingRoute, type WorkbenchClient } from '../api/client';
import type { RawEvent } from '../api/sse';
import type { S2Token } from '../api/types';

/** s2 pings every ~15 s; nothing for this long and the read is opened again. */
export const STALE_MS = 30_000;
/** A new token this long before the old one ends. */
export const RENEW_BEFORE_MS = 60_000;
/** A read is opened afresh this often (from where it was): an XMLHttpRequest keeps all it was sent. */
export const RECYCLE_MS = 5 * 60_000;

// ---- one token per account (server + session), in memory only ----------------

const tokens = new Map<string, S2Token>();
const asking = new Map<string, Promise<S2Token | null>>();
/** Servers without the token route (older ones): not asked again. */
const missing = new Set<string>();

const fresh = (t: S2Token | undefined | null): t is S2Token =>
  !!t && t.expires_at * 1000 - Date.now() >= RENEW_BEFORE_MS + 5_000;

/** The account's read token: the one held while it lasts, else a new one (one ask at a time). */
export function s2Token(client: WorkbenchClient): Promise<S2Token | null> {
  const key = client.liveKey;
  const held = tokens.get(key);
  if (fresh(held)) return Promise.resolve(held);
  if (missing.has(key)) return Promise.resolve(null);
  let p = asking.get(key);
  if (!p) {
    p = client
      .s2Token()
      .then(
        (t) => {
          if (t && typeof t.token === 'string' && typeof t.prefix === 'string') {
            tokens.set(key, t);
            return t;
          }
          return null;
        },
        (e) => {
          if (isMissingRoute(e)) missing.add(key);
          return null;
        },
      )
      .finally(() => asking.delete(key));
    asking.set(key, p);
  }
  return p;
}

/** This server has no live streams (an older one): poll. */
export function s2Missing(client: WorkbenchClient): boolean {
  return missing.has(client.liveKey);
}

/** A token the gate refused: the next read asks for a new one. */
export function dropS2Token(client: WorkbenchClient, tok: S2Token | null): void {
  if (tok && tokens.get(client.liveKey) === tok) tokens.delete(client.liveKey);
}

/** Forget every token (tests; an account signed out keeps none worth keeping). */
export function forgetS2Tokens(): void {
  tokens.clear();
  asking.clear();
  missing.clear();
}

// ---- following one stream ------------------------------------------------------

export interface S2FollowOpts {
  /** The stream's name after the account's prefix (`bus`, `orch`, `chat-<id>`); none: the token's own (`activity`). */
  stream?: string;
  /** Every record of a batch (an event stream); else only the last (figures). */
  every?: boolean;
  /** Only what comes from now (its tail first, so a read cut before its first record misses nothing). */
  fromTail?: boolean;
  /** Live as soon as the read is open (an event stream), not only once a record came. */
  onOpen?: () => void;
  /** A stream made on demand (POST /api/s2/streams), asked before the first read and after a refused one. */
  prepare?: () => Promise<boolean>;
  /** Live or not, as it changes. */
  onLive?: (live: boolean) => void;
  /** May it read now (the app in the front)? Asked before each connect. */
  awake?: () => boolean;
}

type Timer = ReturnType<typeof setTimeout>;

export class S2Follow<T> {
  private on = false;
  private isLive = false;
  private tok: S2Token | null = null;
  private ctrl: AbortController | null = null;
  private seq = -1;
  private fails = 0;
  private wake: Timer | null = null;
  private renew: Timer | null = null;
  private stale: Timer | null = null;
  private recycle: Timer | null = null;
  private gen = 0;
  private ready = false;

  constructor(
    private readonly client: WorkbenchClient,
    private readonly onRecord: (v: T) => void,
    private readonly opts: S2FollowOpts = {},
  ) {}

  /** Records are arriving (or, for an event stream, the read is open): polling can rest. */
  live(): boolean {
    return this.isLive;
  }

  start(): void {
    if (this.on) return;
    this.on = true;
    this.fails = 0;
    void this.connect();
  }

  stop(): void {
    this.on = false;
    this.close();
  }

  pause(): void {
    this.close();
  }

  resume(): void {
    if (this.on && !this.ctrl && !this.wake) void this.connect();
  }

  private setLive(b: boolean): void {
    if (b === this.isLive) return;
    this.isLive = b;
    try {
      this.opts.onLive?.(b);
    } catch {
      // the caller's
    }
  }

  private close(): void {
    this.gen++;
    this.ctrl?.abort();
    this.ctrl = null;
    for (const t of [this.wake, this.renew, this.stale, this.recycle]) if (t) clearTimeout(t);
    this.wake = this.renew = this.stale = this.recycle = null;
    this.setLive(false);
  }

  private later(ms: number): void {
    if (this.wake) clearTimeout(this.wake);
    this.wake = setTimeout(() => {
      this.wake = null;
      void this.connect();
    }, ms);
  }

  private failed(dropToken = false): void {
    if (dropToken) {
      dropS2Token(this.client, this.tok);
      this.tok = null;
    }
    this.ctrl?.abort();
    this.ctrl = null;
    this.setLive(false);
    this.fails++;
    this.later(this.fails <= 1 ? 1_000 : Math.min(300_000, 15_000 * 2 ** (this.fails - 2)));
  }

  private reopen(gen: number): void {
    if (gen !== this.gen) return;
    this.close();
    void this.connect();
  }

  private freshen(gen: number): void {
    if (this.stale) clearTimeout(this.stale);
    this.stale = setTimeout(() => this.reopen(gen), STALE_MS);
  }

  private async connect(): Promise<void> {
    if (!this.on || (this.opts.awake && !this.opts.awake())) return;
    const gen = ++this.gen;
    if (!fresh(this.tok)) {
      this.tok = await s2Token(this.client);
      if (gen !== this.gen) return;
      if (!this.tok) {
        if (s2Missing(this.client)) return; // an older server: the caller polls, for good
        this.failed();
        return;
      }
    }
    if (this.opts.prepare && !this.ready) {
      this.ready = await this.opts.prepare();
      if (gen !== this.gen) return;
      if (!this.ready) {
        this.failed();
        return;
      }
    }
    const tok = this.tok;
    const ctrl = new AbortController();
    this.ctrl = ctrl;
    const stream = this.opts.stream ? tok.prefix + this.opts.stream : tok.stream;
    // From now, the first time: where "now" is, so a read cut before its
    // first record goes on from there too (nothing in between is missed).
    if (this.opts.fromTail && this.seq < 0) {
      const n = await this.client.s2Tail(tok, stream, ctrl.signal);
      if (gen !== this.gen) return;
      if (typeof n === 'number' && this.seq < 0) this.seq = n - 1;
    }
    // From the record after the last one seen; the first time, the latest
    // one. clamp: a stream made anew (s2 drops an empty one) starts at its tail.
    const from =
      this.seq >= 0 ? `seq_num=${this.seq + 1}&clamp=true` : `tail_offset=${this.opts.fromTail ? 0 : 1}&clamp=true`;
    let endedByGate = false;
    let res: { status: number; stream: boolean };
    try {
      res = await this.client.s2Read(tok, stream, from, {
        signal: ctrl.signal,
        onOpen: () => {
          if (gen !== this.gen) return;
          this.opened(gen, tok);
        },
        onEvent: (ev) => {
          if (gen !== this.gen) return;
          if (!this.event(ev, gen)) {
            endedByGate = true;
            ctrl.abort();
          }
        },
      });
    } catch {
      if (gen !== this.gen) return;
      if (!endedByGate) {
        this.failed();
        return;
      }
      res = { status: 200, stream: true };
    }
    if (gen !== this.gen) return;
    if (!res.stream) {
      if (res.status === 401 || res.status === 403) {
        this.failed(true);
        return;
      }
      if (res.status === 404) this.ready = false; // dropped while empty: made again first
      this.failed();
      return;
    }
    // The read ended (the gate ended it - token over, or revoked - or the server closed it): again at once.
    this.ctrl = null;
    for (const t of [this.renew, this.stale, this.recycle]) if (t) clearTimeout(t);
    this.renew = this.stale = this.recycle = null;
    this.setLive(false);
    this.ready = false;
    this.later(this.fails++ < 2 ? 200 : 5_000);
  }

  /** The read is open: its token renewed in time, opened afresh now and then, live for an event stream. */
  private opened(gen: number, tok: S2Token): void {
    if (this.renew) clearTimeout(this.renew);
    this.renew = setTimeout(
      () => {
        this.renew = null;
        this.tok = null;
        this.reopen(gen);
      },
      Math.max(5_000, tok.expires_at * 1000 - Date.now() - RENEW_BEFORE_MS),
    );
    if (this.recycle) clearTimeout(this.recycle);
    this.recycle = setTimeout(() => this.reopen(gen), RECYCLE_MS);
    this.freshen(gen);
    if (this.opts.onOpen) {
      this.fails = 0;
      this.setLive(true);
      try {
        this.opts.onOpen();
      } catch {
        // the caller's
      }
    }
  }

  /** One SSE event; false when the read should be left (the gate ended it). */
  private event(ev: RawEvent, gen: number): boolean {
    this.freshen(gen);
    if (ev.event === 'error') return false;
    if (ev.event !== 'batch' || !ev.data) return true;
    try {
      const recs: { seq_num: number; body: string }[] = JSON.parse(ev.data).records || [];
      const last = recs[recs.length - 1];
      if (!last) return true;
      this.seq = last.seq_num;
      if (this.opts.every) {
        for (const r of recs) {
          try {
            this.onRecord(JSON.parse(r.body) as T);
          } catch {
            // one record not ours to read
          }
        }
      } else this.onRecord(JSON.parse(last.body) as T);
      this.fails = 0;
      this.setLive(true);
    } catch {
      // a batch not ours to read: skipped
    }
    return true;
  }
}
