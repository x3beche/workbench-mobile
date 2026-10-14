/**
 * Server-sent events, read from a response that is still arriving.
 *
 * The Workbench server streams an answer as `data: {json}\n\n` blocks, with
 * `: ping` comments as keep-alives (backend/cc_chat.py). React Native has no
 * EventSource and its fetch has no readable body, but its XMLHttpRequest
 * hands over the text as it comes (onprogress), and so does a browser's - so
 * one reader serves both, and it works for POST as well as GET.
 */
import type { ChatEvent } from './types';

/** Splits a growing text into events. Feed it the new text only. */
export class SseParser {
  private buf = '';

  push(chunk: string): ChatEvent[] {
    this.buf += chunk.replace(/\r\n?/g, '\n');
    const out: ChatEvent[] = [];
    let cut: number;
    while ((cut = this.buf.indexOf('\n\n')) >= 0) {
      const block = this.buf.slice(0, cut);
      this.buf = this.buf.slice(cut + 2);
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) data.push(line.slice(line.startsWith('data: ') ? 6 : 5));
        // ":" lines are comments (keep-alives); "event:"/"id:" are not used by the server.
      }
      if (!data.length) continue;
      try {
        const ev = JSON.parse(data.join('\n'));
        if (ev && typeof ev === 'object' && typeof ev.type === 'string') out.push(ev as ChatEvent);
      } catch {
        // A broken block: skipped, as the web app does.
      }
    }
    return out;
  }
}

export interface XhrLike {
  readyState: number;
  status: number;
  responseText: string;
  withCredentials: boolean;
  onprogress: ((this: XhrLike, ev: unknown) => unknown) | null;
  onreadystatechange: ((this: XhrLike, ev: unknown) => unknown) | null;
  onerror: ((this: XhrLike, ev: unknown) => unknown) | null;
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  getResponseHeader(name: string): string | null;
  send(body?: string | null): void;
  abort(): void;
}

export interface StreamOptions {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string | null;
  onEvent: (ev: ChatEvent) => void;
  /** Anything arrived, a keep-alive too. */
  onActivity?: () => void;
  signal?: AbortSignal;
  createXhr?: () => XhrLike;
}

/** How a stream ended: `stream` true when it was an event stream, else the
 *  status and body of a plain answer (an error, or a 202 for a queued line). */
export interface StreamResult {
  status: number;
  stream: boolean;
  text: string;
}

export function streamSse(opts: StreamOptions): Promise<StreamResult> {
  const xhr = opts.createXhr ? opts.createXhr() : (new XMLHttpRequest() as unknown as XhrLike);
  const parser = new SseParser();
  let seen = 0;
  let isStream: boolean | null = null;

  return new Promise<StreamResult>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => {
      xhr.abort();
      finish(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    };
    if (opts.signal?.aborted) {
      onAbort();
      return;
    }
    opts.signal?.addEventListener('abort', onAbort);

    const drain = () => {
      if (isStream === null && xhr.readyState >= 2) {
        const ct = xhr.getResponseHeader('content-type') || '';
        isStream = xhr.status >= 200 && xhr.status < 300 && ct.includes('text/event-stream');
      }
      if (!isStream) return;
      const text = xhr.responseText || '';
      if (text.length > seen) {
        const chunk = text.slice(seen);
        seen = text.length;
        opts.onActivity?.();
        for (const ev of parser.push(chunk)) {
          if (settled) return;
          opts.onEvent(ev);
        }
      }
    };

    xhr.open(opts.method, opts.url);
    xhr.withCredentials = true;
    for (const [k, v] of Object.entries(opts.headers)) xhr.setRequestHeader(k, v);
    xhr.onprogress = () => drain();
    xhr.onreadystatechange = () => {
      drain();
      if (xhr.readyState === 4) {
        if (xhr.status === 0) {
          finish(() => reject(new Error('The server could not be reached.')));
          return;
        }
        finish(() => resolve({ status: xhr.status, stream: !!isStream, text: isStream ? '' : xhr.responseText }));
      }
    };
    xhr.onerror = () => finish(() => reject(new Error('The server could not be reached.')));
    xhr.send(opts.body ?? null);
  });
}
