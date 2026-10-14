/** Test doubles for the network: an XMLHttpRequest that is fed by hand, and a fetch that records calls. */
import type { XhrLike } from '../sse';

export class FakeXhr implements XhrLike {
  readyState = 0;
  status = 0;
  responseText = '';
  withCredentials = false;
  onprogress: XhrLike['onprogress'] = null;
  onreadystatechange: XhrLike['onreadystatechange'] = null;
  onerror: XhrLike['onerror'] = null;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: string | null | undefined;
  aborted = false;
  private contentType = '';

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  getResponseHeader(name: string) {
    return name.toLowerCase() === 'content-type' ? this.contentType : null;
  }
  send(body?: string | null) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
  }

  /** The server answers: status and headers. */
  respond(status: number, contentType: string) {
    this.status = status;
    this.contentType = contentType;
    this.readyState = 2;
    this.onreadystatechange?.call(this, {});
  }
  /** More of the body arrives. */
  chunk(text: string) {
    this.readyState = 3;
    this.responseText += text;
    this.onprogress?.call(this, {});
  }
  /** The body is complete. */
  end() {
    this.readyState = 4;
    this.onreadystatechange?.call(this, {});
  }
  fail() {
    this.onerror?.call(this, {});
  }
}

export interface Call {
  url: string;
  init: RequestInit;
}

export function jsonResponse(status: number, body: unknown, contentType = 'application/json'): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

/** A fetch that answers from `route(url, init)` and keeps every call. */
export function fakeFetch(route: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return route(url, init);
  });
  return { fetch: fn, calls };
}
