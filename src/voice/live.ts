/**
 * Live voice to text: the words come into the box while they are spoken.
 *
 * The microphone's 16 kHz mono PCM16 goes over `WS /api/voice/live`
 * (redline-studio backend/voice_live.py) to the server's own Whisper, and
 * the words come back: `final` words, which will not change (appended), and
 * the `partial` tail, which may (replaces the last one, shown dimmed).
 *
 *   -> {"type": "start", "lang", "purpose", "format": "pcm16", "polish": false}
 *   -> binary frames of PCM, ~100 ms each
 *   -> {"type": "stop"}
 *   <- ready {model} | partial {text} | final {text}
 *   <- done {text, seconds, model, language, reason} | error {code, message}, then it closes
 *
 * Signed in by the session cookie the platform keeps (React Native's
 * WebSocket sends it, and the server's Origin check passes: the phone's
 * Origin is the server's own address; a browser is on the page's origin).
 * Anything before "ready" - no such route on an older server, the service
 * down or busy, no answer in time - and the caller records the old way;
 * a break after it and the recording underneath is written out instead.
 * Nothing is sent on by itself: the text stays in the box to read over.
 */

/** Just the part of a WebSocket this uses: the platform's, or a fake in tests. */
export interface SocketLike {
  binaryType?: string;
  readyState: number;
  send(data: string | ArrayBuffer): void;
  close(code?: number): void;
  onopen: ((e: unknown) => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onclose: ((e: unknown) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

const OPEN = 1;

/** What the server says at the end. */
export interface LiveDone {
  text: string;
  seconds: number;
  model: string;
  language: string;
  reason: 'stop' | 'limit' | 'idle';
}

/** How opening went: heard ("ready"), or why not ("down", "busy", "auth", ..., "timeout", "closed"). */
export type LiveOpen = { ok: true; model: string } | { ok: false; code: string; message: string };

export interface LiveEvents {
  /** The settled words so far and the unsure tail after them. */
  words?: (settled: string, tail: string) => void;
  /** An error after "ready": the words so far stand, the recording takes over. */
  broke?: (code: string, message: string) => void;
}

/** One frame on the wire: 100 ms of 16 kHz PCM16. */
export const FRAME_BYTES = 3200;
/** What is kept while the socket is opened: the first words are not lost (10 s). */
const EARLY_MAX = 320_000;

/** The socket's address beside the server's: http -> ws, https -> wss. */
export function liveUrl(base: string): string {
  return base.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/api/voice/live';
}

/** Words after text: one space between, none doubled. */
export function joinWords(cur: string, words: string): string {
  const w = words.replace(/^\s+/, '');
  if (!w) return cur;
  if (!cur.trim()) return w;
  return cur + (/\s$/.test(cur) ? '' : ' ') + w;
}

const defaultSocket: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;

/** One live stream. `push` the microphone's bytes from the start; `open` then `finish` or `close`. */
export class LiveSession {
  settled = '';
  tail = '';
  model = '';
  private ws: SocketLike | null = null;
  private ready = false;
  private ended = false;
  private pending: Uint8Array[] = [];
  private pendingLen = 0;
  private doneWait: ((d: LiveDone | null) => void) | null = null;

  constructor(
    private readonly url: string,
    private readonly opts: { lang: string; purpose: 'chat' | 'note' },
    private readonly on: LiveEvents = {},
    private readonly connect: SocketFactory = defaultSocket,
  ) {}

  /** True once the server said "ready" and nothing broke since. */
  get live(): boolean {
    return this.ready && !this.ended;
  }

  open(timeoutMs = 4000): Promise<LiveOpen> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (r: LiveOpen) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };
      const timer = setTimeout(() => {
        settle({ ok: false, code: 'timeout', message: 'live voice to text did not answer' });
        this.close();
      }, timeoutMs);
      let ws: SocketLike;
      try {
        ws = this.connect(this.url);
      } catch (e) {
        settle({ ok: false, code: 'closed', message: e instanceof Error ? e.message : '' });
        return;
      }
      this.ws = ws;
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        try {
          ws.send(
            JSON.stringify({
              type: 'start',
              lang: this.opts.lang,
              purpose: this.opts.purpose,
              format: 'pcm16',
              polish: false,
            }),
          );
        } catch {
          /* onclose says it */
        }
      };
      ws.onmessage = (m) => {
        if (typeof m.data !== 'string') return;
        let e: { type?: string; text?: string; code?: string; message?: string; model?: string };
        try {
          e = JSON.parse(m.data);
        } catch {
          return;
        }
        if (e.type === 'ready') {
          this.ready = true;
          this.model = e.model || '';
          this.flush(true);
          settle({ ok: true, model: this.model });
        } else if (e.type === 'partial') {
          this.tail = e.text || '';
          this.on.words?.(this.settled, this.tail);
        } else if (e.type === 'final') {
          // Whisper's words carry their own leading space ("" + " so" + " it"), and a
          // piece that does not (a comma, "32" after "STM") belongs to the word before.
          this.settled += e.text || '';
          this.tail = '';
          this.on.words?.(this.settled, this.tail);
        } else if (e.type === 'done') {
          this.ended = true;
          this.resolveDone(e as unknown as LiveDone);
          this.close();
        } else if (e.type === 'error') {
          const code = e.code || 'failed';
          const message = e.message || '';
          const wasLive = this.ready && !this.ended;
          this.ended = true;
          settle({ ok: false, code, message });
          if (wasLive) this.on.broke?.(code, message);
          this.resolveDone(null);
          this.close();
        }
      };
      ws.onerror = () => {
        /* onclose says it */
      };
      ws.onclose = () => {
        settle({ ok: false, code: 'closed', message: 'live voice to text is not offered here' });
        if (this.ready && !this.ended) {
          this.ended = true;
          this.on.broke?.('failed', '');
        }
        this.ended = true;
        this.resolveDone(null);
        this.ws = null;
      };
    });
  }

  /** The microphone's bytes: kept until "ready", then sent a frame at a time. */
  push(pcm: Uint8Array): void {
    if (this.ended || !pcm.length) return;
    this.pending.push(pcm);
    this.pendingLen += pcm.length;
    if (!this.ready) {
      // Before "ready" only the newest few seconds are kept.
      while (this.pendingLen > EARLY_MAX && this.pending.length > 1) this.pendingLen -= this.pending.shift()!.length;
      return;
    }
    if (this.pendingLen >= FRAME_BYTES) this.flush();
  }

  /** The person stopped: the last words, then the whole text (null: it broke or never was). */
  finish(timeoutMs = 15000): Promise<LiveDone | null> {
    if (!this.live || !this.ws) return Promise.resolve(null);
    this.flush();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.doneWait = null;
        resolve(null);
        this.close();
      }, timeoutMs);
      this.doneWait = (d) => {
        clearTimeout(timer);
        resolve(d);
      };
      try {
        this.ws!.send(JSON.stringify({ type: 'stop' }));
      } catch {
        this.resolveDone(null);
      }
    });
  }

  /** Throw it all away. */
  close(): void {
    this.pending = [];
    this.pendingLen = 0;
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= OPEN) {
      try {
        ws.close(1000);
      } catch {
        /* gone */
      }
    }
  }

  private resolveDone(d: LiveDone | null) {
    const w = this.doneWait;
    this.doneWait = null;
    w?.(d);
  }

  /** What is kept, in frames; `all` sends the early seconds at once, a second at a time. */
  private flush(all = false) {
    const ws = this.ws;
    if (!this.pendingLen || !ws || ws.readyState !== OPEN) return;
    const bytes = new Uint8Array(this.pendingLen);
    let at = 0;
    for (const p of this.pending) {
      bytes.set(p, at);
      at += p.length;
    }
    this.pending = [];
    this.pendingLen = 0;
    const step = all ? PCM_SECOND : bytes.length;
    try {
      for (let i = 0; i < bytes.length; i += step) ws.send(bytes.slice(i, i + step).buffer as ArrayBuffer);
    } catch {
      /* onclose says it */
    }
  }
}

const PCM_SECOND = 32_000;

let toldNoLive = false;
/** The "not available" note is said once a run, not at every recording. */
export function sayNoLiveOnce(): boolean {
  if (toldNoLive) return false;
  toldNoLive = true;
  return true;
}
/** For tests. */
export function resetNoLiveNote(): void {
  toldNoLive = false;
}
