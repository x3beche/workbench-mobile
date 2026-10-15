/**
 * The Workbench API, as the app uses it.
 *
 * Signing in is the web app's own: POST /api/auth/login sets the
 * `redline_session` cookie (HttpOnly). On Android and iOS the platform's
 * cookie store keeps it and sends it back; in a browser it is the browser's.
 * The app never sees or stores the session itself. Every request that
 * changes something carries `x-redline-csrf: 1`, which the server asks of
 * every mutating cookie request (backend/auth.py, csrf_ok).
 */
import { streamSse, type StreamResult, type XhrLike } from './sse';
import type { AuthState, Chat, ChatEvent, Ideas, Model, Provider, Queued, Transcript, User } from './types';

export const CSRF_HEADER = 'x-redline-csrf';
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 180_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The message a person should read for a failed request. */
export function errorMessage(status: number, body: string): string {
  let detail: unknown;
  try {
    detail = JSON.parse(body)?.detail;
  } catch {
    detail = undefined;
  }
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === 'string') return detail[0].msg;
  if (status === 401) return 'Sign in first.';
  if (status === 403) return 'Your account may not do that.';
  if (status === 404) return 'Not found on this server.';
  if (status === 429) return 'Too many tries - wait a while and try again.';
  if (status >= 500) return `The server had a problem (HTTP ${status}).`;
  return `The request failed (HTTP ${status}).`;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientDeps {
  fetch?: FetchLike;
  createXhr?: () => XhrLike;
  /** Called when the server says the session is gone (401 on a signed-in route). */
  onUnauthorized?: () => void;
}

/** A recording to transcribe: a file uri on a phone, a Blob in a browser. */
export type AudioFile = { uri: string; name: string; type: string } | { blob: Blob; name: string };

export type VoiceLang = 'auto' | 'tr' | 'en';

export interface SayHandlers {
  onEvent: (ev: ChatEvent) => void;
  onActivity?: () => void;
  signal?: AbortSignal;
}

export class WorkbenchClient {
  private readonly fetchImpl: FetchLike;

  constructor(
    readonly base: string,
    private readonly deps: ClientDeps = {},
  ) {
    this.fetchImpl = deps.fetch ?? ((input, init) => fetch(input, init));
  }

  url(path: string): string {
    return this.base + path;
  }

  async request<T>(method: string, path: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<T> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') headers[CSRF_HEADER] = '1';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'include',
        signal: ctl.signal,
      });
    } catch {
      throw new ApiError(
        0,
        ctl.signal.aborted ? 'The server took too long to answer.' : 'The server could not be reached.',
      );
    } finally {
      clearTimeout(timer);
    }
    return this.read<T>(res, path);
  }

  private async read<T>(res: Response, path: string): Promise<T> {
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401 && !path.startsWith('/api/auth/')) this.deps.onUnauthorized?.();
      throw new ApiError(res.status, errorMessage(res.status, text));
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(res.status, 'The server answered with something that is not Workbench.');
    }
  }

  // ---- the server and signing in ---------------------------------------

  /**
   * Is this a Workbench server? /api/health answers {ok: true} without a
   * session, and /api/auth/state says whether sign-in is on.
   */
  async probe(): Promise<AuthState> {
    const health = await this.request<{ ok?: boolean }>('GET', '/api/health');
    if (!health || health.ok !== true) throw new ApiError(0, 'That server does not look like Workbench.');
    return this.authState();
  }

  authState(): Promise<AuthState> {
    return this.request<AuthState>('GET', '/api/auth/state');
  }

  async login(email: string, password: string): Promise<User> {
    const got = await this.request<{ user: User }>('POST', '/api/auth/login', {
      email: email.trim(),
      password,
      remember: false,
    });
    return got.user;
  }

  async logout(): Promise<void> {
    await this.request('POST', '/api/auth/logout', {});
  }

  // ---- conversations ----------------------------------------------------

  /** The conversations, newest first (pinned on top). `q` also searches what was said in them. */
  listChats(q = ''): Promise<Chat[]> {
    const find = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : '';
    return this.request<Chat[]>('GET', `/api/cc/chats?archived=0${find}`);
  }

  getChat(id: string): Promise<Chat> {
    return this.request<Chat>('GET', `/api/cc/chats/${encodeURIComponent(id)}`);
  }

  createChat(provider?: string, model?: string): Promise<Chat> {
    return this.request<Chat>('POST', '/api/cc/chats', { provider, model });
  }

  setModel(id: string, provider: string, model: string): Promise<Chat> {
    return this.request<Chat>('PATCH', `/api/cc/chats/${encodeURIComponent(id)}`, { provider, model });
  }

  rename(id: string, title: string): Promise<Chat> {
    return this.request<Chat>('PATCH', `/api/cc/chats/${encodeURIComponent(id)}`, { title: title.trim() });
  }

  /** Out of the list; the web app's Archived view still has it. */
  archive(id: string): Promise<Chat> {
    return this.request<Chat>('PATCH', `/api/cc/chats/${encodeURIComponent(id)}`, { archived: true });
  }

  /** Into the server's trash, which deletes it for good after its days (`days` in the answer). */
  remove(id: string): Promise<{ deleted: string; trash?: boolean; days?: number }> {
    return this.request('DELETE', `/api/cc/chats/${encodeURIComponent(id)}`);
  }

  /** Example questions for an empty conversation (null when the server has none to give). */
  async ideas(lang: 'en' | 'tr'): Promise<Ideas | null> {
    try {
      return await this.request<Ideas>('GET', `/api/cc/ideas?lang=${lang}`);
    } catch {
      return null;
    }
  }

  stop(id: string): Promise<{ stopped: boolean }> {
    return this.request('POST', `/api/cc/chats/${encodeURIComponent(id)}/stop`, {});
  }

  /** The providers with a key on the server: the ones that can answer. */
  async providers(): Promise<Provider[]> {
    const got = await this.request<{ providers: Record<string, { name: string; set: boolean }> }>(
      'GET',
      '/api/llm/settings',
    );
    return Object.entries(got.providers || {}).map(([id, p]) => ({ id, name: p.name, set: !!p.set }));
  }

  models(provider: string): Promise<Model[]> {
    return this.request<Model[]>('GET', `/api/llm/models?provider=${encodeURIComponent(provider)}`);
  }

  /**
   * Send a line and follow its answer as it is written. Resolves with
   * `queued` when an answer was already being written: the server keeps the
   * line and answers it next (202).
   */
  async say(
    id: string,
    body: { text: string; provider?: string; model?: string; client?: string },
    h: SayHandlers,
  ): Promise<{ queued: Queued | null }> {
    const res = await this.stream('POST', `/api/cc/chats/${encodeURIComponent(id)}/messages`, body, h);
    if (res.stream) return { queued: null };
    return { queued: JSON.parse(res.text || '{}') as Queued };
  }

  /** Follow the answers being written in a conversation (GET /live). */
  async live(id: string, h: SayHandlers): Promise<void> {
    await this.stream('GET', `/api/cc/chats/${encodeURIComponent(id)}/live`, null, h);
  }

  private async stream(method: 'GET' | 'POST', path: string, body: unknown, h: SayHandlers): Promise<StreamResult> {
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      headers[CSRF_HEADER] = '1';
    }
    const res = await streamSse({
      url: this.url(path),
      method,
      headers,
      body: body === null ? null : JSON.stringify(body),
      onEvent: h.onEvent,
      onActivity: h.onActivity,
      signal: h.signal,
      createXhr: this.deps.createXhr,
    });
    if (res.status >= 400) {
      if (res.status === 401) this.deps.onUnauthorized?.();
      throw new ApiError(res.status, errorMessage(res.status, res.text));
    }
    return res;
  }

  // ---- voice --------------------------------------------------------------

  /** A recording turned into text (POST /api/voice/transcribe, multipart). */
  async transcribe(file: AudioFile, lang: VoiceLang, purpose: 'chat' | 'note' = 'chat'): Promise<Transcript> {
    const form = new FormData();
    if ('blob' in file) form.append('audio', file.blob, file.name);
    // React Native's FormData takes a {uri, name, type} part for a file on disk.
    else form.append('audio', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    form.append('lang', lang);
    form.append('purpose', purpose);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), UPLOAD_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url('/api/voice/transcribe'), {
        method: 'POST',
        headers: { Accept: 'application/json', [CSRF_HEADER]: '1' },
        body: form,
        credentials: 'include',
        signal: ctl.signal,
      });
    } catch {
      throw new ApiError(0, ctl.signal.aborted ? 'Transcribing took too long.' : 'The server could not be reached.');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404) {
      throw new ApiError(404, 'This server cannot transcribe voice yet (no /api/voice/transcribe).');
    }
    return this.read<Transcript>(res, '/api/voice/transcribe');
  }
}
