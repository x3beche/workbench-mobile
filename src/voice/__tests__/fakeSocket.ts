/** A WebSocket the tests drive: what the app sent, and the server's side by hand. */
import type { SocketLike } from '../live';

export class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  static last(): FakeSocket {
    return FakeSocket.all[FakeSocket.all.length - 1];
  }

  binaryType = '';
  readyState = 0;
  sent: (string | ArrayBuffer)[] = [];
  closed = false;
  /** The server's answer to a message the app sent, when a test wants one at once. */
  reply: ((data: string | ArrayBuffer) => void) | null = null;
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }

  send(data: string | ArrayBuffer) {
    if (this.readyState !== 1) throw new Error('not open');
    this.sent.push(data);
    if (this.reply) {
      const r = this.reply;
      Promise.resolve().then(() => r(data));
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }

  // ---- the server's side
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  say(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
  /** The server went away (or an older server refused the upgrade). */
  drop() {
    this.readyState = 3;
    this.closed = true;
    this.onclose?.({ code: 1006 });
  }

  /** The JSON messages the app sent, parsed. */
  messages(): { type: string; [k: string]: unknown }[] {
    return this.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d));
  }
  /** How many bytes of audio the app sent. */
  audioBytes(): number {
    return this.sent.reduce((n, d) => n + (typeof d === 'string' ? 0 : d.byteLength), 0);
  }
}
