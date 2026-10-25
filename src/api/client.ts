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
import { streamRawSse, streamSse, type RawEvent, type StreamResult, type XhrLike } from './sse';
import type {
  ActivityNow,
  AdminPool,
  AdminSandboxes,
  AgentTree,
  AuthState,
  Chat,
  ChatEvent,
  ChatScope,
  FileFolder,
  Ideas,
  Incident,
  LlmSummary,
  LlmUsage,
  McpCatalog,
  MyPool,
  Model,
  OrchEvent,
  OrchStatus,
  OrchTranscript,
  Provider,
  Queued,
  Room,
  RoomId,
  RoomLine,
  S2Token,
  StoredFile,
  Transcript,
  ToolsUsage,
  TrashFile,
  UploadPart,
  User,
  VirtualFolder,
  VirtualTree,
  WbcDetail,
  WbcMessage,
  WbcSession,
  WbcTurnsPage,
} from './types';

export const CSRF_HEADER = 'x-redline-csrf';
/**
 * An account's own session (backend/app_session.py): sent on every request
 * instead of the platform's one cookie jar, so several accounts - on one
 * server or several - never share a session.
 */
export const SESSION_HEADER = 'x-workbench-session';
/** The conversation trash's days when the server does not say (cc_chat.TRASH_DAYS). */
export const CHAT_TRASH_DAYS = 30;
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
  /** This account's session, sent as SESSION_HEADER; none for a local-mode server or an older server's cookie. */
  session?: string | null;
}

/** A recording to transcribe: a file uri on a phone, a Blob in a browser. */
export type AudioFile = { uri: string; name: string; type: string } | { blob: Blob; name: string };

export type VoiceLang = 'auto' | 'tr' | 'en';

/** A conversation exported by the server: the file it kept in Files. */
export interface ExportedFile {
  id: string;
  name: string;
  bytes: number;
  folder: string;
  format: 'md' | 'pdf';
  pages?: number;
}

/** The answer of a route this server does not have (an older server): 405, or FastAPI's own 404. */
export function isMissingRoute(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 405 || (e.status === 404 && e.message === 'Not Found'));
}

/** A row's small picture (GET /api/files/{id}/mini): ready, still being made, or none for this file. */
export type Mini = { state: 'ready'; uri: string } | { state: 'later'; seconds: number } | { state: 'none' };

/** The first part of a file as text, and whether there is more of it. */
export interface TextHead {
  text: string;
  cut: boolean;
}

export interface TableData {
  sheets: string[];
  sheet: number;
  rows: string[][];
  total: number;
  truncated: boolean;
}

/** A Blob as a data: URI (FileReader works the same on a phone and in a browser). */
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('The file could not be read.'));
    r.readAsDataURL(blob);
  });
}

export interface SayHandlers {
  onEvent: (ev: ChatEvent) => void;
  onActivity?: () => void;
  signal?: AbortSignal;
}

/** A room's line by its id: the server names it `_id` (a MongoDB document), the app `id`. */
function withId(line: RoomLine): RoomLine {
  const raw = line as RoomLine & { _id?: string };
  return raw && !raw.id && raw._id ? { ...raw, id: raw._id } : raw;
}

export class WorkbenchClient {
  private readonly fetchImpl: FetchLike;
  /** How many days the server's conversation trash keeps one: its own word once the trash was listed, else the default. */
  chatTrashDays = CHAT_TRASH_DAYS;

  constructor(
    readonly base: string,
    private readonly deps: ClientDeps = {},
  ) {
    this.fetchImpl = deps.fetch ?? ((input, init) => fetch(input, init));
  }

  url(path: string): string {
    return this.base + path;
  }

  /** The account's session header, to add to a request (empty without one). */
  auth(): Record<string, string> {
    return this.deps.session ? { [SESSION_HEADER]: this.deps.session } : {};
  }

  /** An image the server serves to this account: its address and the session to send with it. */
  imageSource(url: string): { uri: string; headers?: Record<string, string> } {
    const h = this.auth();
    return Object.keys(h).length ? { uri: url, headers: h } : { uri: url };
  }

  /** A WebSocket opened as this account (React Native takes headers; a browser does not and sends its cookie). */
  socket(url: string): WebSocket {
    const h = this.auth();
    const WS = WebSocket as unknown as new (u: string, p?: string[] | null, o?: { headers: Record<string, string> }) => WebSocket;
    return Object.keys(h).length && typeof document === 'undefined' ? new WS(url, null, { headers: h }) : new WebSocket(url);
  }

  async request<T>(method: string, path: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<T> {
    return (await this.requestFull<T>(method, path, body, timeoutMs)).data;
  }

  /** As `request`, with the answer's headers too. */
  async requestFull<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = TIMEOUT_MS,
  ): Promise<{ data: T; headers: Headers | null }> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json', ...this.auth() };
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
    return { data: await this.read<T>(res, path), headers: res.headers ?? null };
  }

  private async read<T>(res: Response, path: string): Promise<T> {
    const text = await res.text();
    if (!res.ok) {
      // The live streams' token is not the session: its trouble never signs anyone out (the session's own 401 does).
      if (res.status === 401 && !path.startsWith('/api/auth/') && !path.startsWith('/api/s2/')) {
        this.deps.onUnauthorized?.();
      }
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

  /**
   * Sign in as an app: the server hands the session back (`session`) instead
   * of setting its cookie, to be kept for this account alone. A server older
   * than that sets its cookie as before and sends none.
   */
  async login(email: string, password: string): Promise<{ user: User; session: string | null }> {
    const got = await this.request<{ user: User; session?: string }>('POST', '/api/auth/login', {
      email: email.trim(),
      password,
      remember: false,
      app: true,
    });
    return { user: got.user, session: typeof got.session === 'string' && got.session ? got.session : null };
  }

  /**
   * The session this request is signed in with (the old cookie) traded for a
   * session of the app's own (POST /api/auth/app-session); null on a server
   * without the route.
   */
  async appSession(): Promise<string | null> {
    try {
      const got = await this.request<{ session?: string }>('POST', '/api/auth/app-session', {});
      return typeof got?.session === 'string' && got.session ? got.session : null;
    } catch (e) {
      if (isMissingRoute(e)) return null;
      throw e;
    }
  }

  async logout(): Promise<void> {
    await this.request('POST', '/api/auth/logout', {});
  }

  // ---- conversations ----------------------------------------------------

  /**
   * The conversations, newest first (pinned on top). `q` also searches what
   * was said in them. `scope` is the live ones, the archived ones, or the
   * trash (newest deleted first).
   */
  async listChats(q = '', scope: ChatScope = 'live'): Promise<Chat[]> {
    const find = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : '';
    const which = scope === 'trash' ? 'trash=1' : scope === 'archived' ? 'archived=1' : 'archived=0';
    const got = await this.requestFull<Chat[]>('GET', `/api/cc/chats?${which}${find}`);
    if (scope === 'trash') {
      // How long the trash keeps one (X-Trash-Days); an older server does not say.
      const days = Number(got.headers?.get('x-trash-days'));
      if (Number.isFinite(days) && days > 0) this.chatTrashDays = days;
    }
    return got.data;
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

  /** Out of the list, into Archived; `false` brings it back. */
  archive(id: string, archived = true): Promise<Chat> {
    return this.request<Chat>('PATCH', `/api/cc/chats/${encodeURIComponent(id)}`, { archived });
  }

  /** Pinned conversations stay at the top of the list. */
  pin(id: string, pinned: boolean): Promise<Chat> {
    return this.request<Chat>('PATCH', `/api/cc/chats/${encodeURIComponent(id)}`, { pinned });
  }

  /** Into the server's trash, which deletes it for good after its days (`days` in the answer). */
  remove(id: string): Promise<{ deleted: string; trash?: boolean; days?: number }> {
    return this.request('DELETE', `/api/cc/chats/${encodeURIComponent(id)}`);
  }

  /** Out of the trash, as it was (pinned, archived, every line). */
  restoreChat(id: string): Promise<Chat> {
    return this.request<Chat>('POST', `/api/cc/chats/${encodeURIComponent(id)}/restore`, {});
  }

  /** Gone for good, from the trash or straight away. */
  removeForever(id: string): Promise<{ deleted: string; forever: boolean }> {
    return this.request('DELETE', `/api/cc/chats/${encodeURIComponent(id)}?forever=1`);
  }

  /**
   * The conversation written out by the server (backend/chat_export.py):
   * Markdown or a PDF in the document theme, kept in Files under
   * In the app > Chat/Exports and answered with that file, to download.
   */
  exportChat(id: string, format: 'md' | 'pdf', lang: 'en' | 'tr' = 'en'): Promise<ExportedFile> {
    return this.request<ExportedFile>('POST', `/api/cc/chats/${encodeURIComponent(id)}/export`, {
      format,
      lang,
    });
  }

  /** Everything in the trash one may delete, gone for good; `kept` counts the rest. */
  emptyTrash(): Promise<{ deleted: number; kept: number }> {
    return this.request('POST', '/api/cc/chats/empty-trash', {});
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
    const headers: Record<string, string> = { Accept: 'text/event-stream', ...this.auth() };
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

  // ---- the agent rooms ----------------------------------------------------

  /**
   * The three rooms of the workspace chat (3D Drawing, PCB Design,
   * Firmware), each with its last line, what waits to be read, and when the
   * agent last wrote in it.
   */
  rooms(): Promise<Room[]> {
    return this.request<Room[]>('GET', '/api/chat/rooms');
  }

  /**
   * A room's thread, oldest first (`limit` for the last few lines, 0 for all
   * of them). The rooms have no stream, so this is read again while one is
   * open on screen.
   */
  async roomHistory(room: RoomId, limit = 0, before?: string): Promise<RoomLine[]> {
    const cap = limit > 0 ? `&limit=${limit}` : '';
    // The lines before one (a page further back); a server older than paging leaves it out.
    const back = before ? `&before=${encodeURIComponent(before)}` : '';
    const got = await this.request<RoomLine[]>('GET', `/api/chat?room=${encodeURIComponent(room)}${cap}${back}`);
    return (got ?? []).map(withId);
  }

  /** Say something in a room: the agent working in it is told, and answers there. */
  async sayRoom(room: RoomId, text: string, urgent = false): Promise<RoomLine> {
    return withId(await this.request<RoomLine>('POST', '/api/chat', { room, text, urgent }));
  }

  // ---- the Orchestrator ---------------------------------------------------

  /** One's own Orchestrator: its state, model, why it stopped, the providers to pick from. */
  orchestrator(): Promise<OrchStatus> {
    return this.request<OrchStatus>('GET', '/api/me/orchestrator');
  }

  /** Start it (or start it again on the model chosen). */
  orchestratorStart(): Promise<OrchStatus> {
    return this.request<OrchStatus>('POST', '/api/me/orchestrator/start', {}, 90_000);
  }

  orchestratorStop(): Promise<OrchStatus> {
    return this.request<OrchStatus>('POST', '/api/me/orchestrator/stop', {}, 60_000);
  }

  /** The provider and model it runs on (Agent & LLM's choice). */
  setAgentModel(provider: string, model: string): Promise<unknown> {
    return this.request('PUT', '/api/me/llm/agent', { provider_id: provider, model });
  }

  /** Its own session and the sub-agents it started. */
  orchestratorTree(): Promise<AgentTree> {
    return this.request<AgentTree>('GET', '/api/me/orchestrator/tree');
  }

  /** A session's transcript, read-only. */
  orchestratorSession(sid: string): Promise<OrchTranscript> {
    return this.request<OrchTranscript>('GET', `/api/me/orchestrator/sessions/${encodeURIComponent(sid)}`);
  }

  /** What it does, live (text/event-stream) until the stream ends or `signal` stops it. */
  async orchestratorEvents(h: {
    onEvent: (ev: OrchEvent) => void;
    onActivity?: () => void;
    signal?: AbortSignal;
    /** Held only quietly: the events come through the account's S2 stream `orch` (its hello says `via: "s2"`). */
    quiet?: boolean;
  }): Promise<void> {
    await this.stream('GET', `/api/me/orchestrator/events${h.quiet ? '?via=s2' : ''}`, null, {
      onEvent: (ev) => h.onEvent(ev as unknown as OrchEvent),
      onActivity: h.onActivity,
      signal: h.signal,
    });
  }

  /** The MCP server's version and every tool it offers. */
  mcpTools(): Promise<McpCatalog> {
    return this.request<McpCatalog>('GET', '/api/mcp/tools');
  }

  // ---- analytics (the web app's Chat cards and Settings) --------------------

  llmSummary(days = 14): Promise<LlmSummary> {
    return this.request<LlmSummary>('GET', `/api/llm/summary?days=${days}`);
  }

  llmUsage(days = 30): Promise<LlmUsage> {
    return this.request<LlmUsage>('GET', `/api/llm/usage?provider=all&days=${days}`);
  }

  toolsUsage(span: 'week' | 'month' = 'week'): Promise<ToolsUsage> {
    return this.request<ToolsUsage>('GET', `/api/cc/tools-usage?span=${span}`);
  }

  orchestratorIncidents(): Promise<{ incidents: Incident[] }> {
    return this.request('GET', '/api/me/orchestrator/incidents');
  }

  myPool(): Promise<MyPool> {
    return this.request<MyPool>('GET', '/api/pool');
  }

  adminPool(): Promise<AdminPool> {
    return this.request<AdminPool>('GET', '/api/admin/pool');
  }

  adminSandboxes(): Promise<AdminSandboxes> {
    return this.request<AdminSandboxes>('GET', '/api/admin/sandboxes');
  }

  /** What goes on now: tokens a second, jobs, the machine (the web top bar's Activity). */
  activityNow(): Promise<ActivityNow> {
    return this.request<ActivityNow>('GET', '/api/me/activity/now');
  }

  // ---- live streams through S2 (backend/s2live.py) ---------------------------

  /** A read token for the account's own streams, ~15 minutes. Its 401/403 never signs out. */
  s2Token(): Promise<S2Token> {
    return this.request<S2Token>('POST', '/api/s2/token', {});
  }

  /** One's own streams made ready to read (`orch`, `dm`, `chat-<id>`; at most four). */
  async s2Streams(names: string[]): Promise<boolean> {
    try {
      await this.request('POST', '/api/s2/streams', { names });
      return true;
    } catch {
      return false;
    }
  }

  /** Where a stream of the account's is read, through the server's gate. */
  s2Url(tok: S2Token, stream: string): string {
    return `${this.base}${tok.path}/v1/streams/${encodeURIComponent(stream)}/records`;
  }

  /** The seq_num the next record of a stream gets (its tail); null when it could not be read. */
  async s2Tail(tok: S2Token, stream: string, signal?: AbortSignal): Promise<number | null> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const stop = () => ctl.abort();
    signal?.addEventListener('abort', stop);
    try {
      const res = await this.fetchImpl(`${this.s2Url(tok, stream)}/tail`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${tok.token}`, Accept: 'application/json' },
        credentials: 'omit',
        signal: ctl.signal,
      });
      if (!res.ok) return null;
      const n = (await res.json())?.tail?.seq_num;
      return typeof n === 'number' ? n : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
    }
  }

  /**
   * A live read of a stream (SSE): `batch` events with records, `error` when
   * the gate ends it, pings. The token goes in the Authorization header,
   * never in the address; no cookies go with it.
   */
  s2Read(
    tok: S2Token,
    stream: string,
    from: string,
    h: { onEvent: (ev: RawEvent) => void; onOpen?: () => void; signal?: AbortSignal },
  ): Promise<StreamResult> {
    return streamRawSse({
      url: `${this.s2Url(tok, stream)}?${from}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tok.token}`, Accept: 'text/event-stream' },
      onEvent: h.onEvent,
      onOpen: h.onOpen,
      signal: h.signal,
      createXhr: this.deps.createXhr,
      credentials: false,
    });
  }

  /** Who the live streams' tokens are kept under in memory: this account on this server. */
  get liveKey(): string {
    return `${this.base}|${this.deps.session ?? ''}`;
  }

  // ---- Claude sessions (backend/wbclaude.py) ---------------------------------

  /** One's own Claude Code sessions from the Claude pool, connected ones first. */
  async wbcSessions(): Promise<WbcSession[]> {
    const got = await this.request<{ sessions?: WbcSession[] }>('GET', '/api/wbc/sessions');
    return got?.sessions ?? [];
  }

  /** One session: who may write to it and why not, its wb-claude, the lines sent from Workbench. */
  wbcSession(sid: string): Promise<WbcDetail> {
    return this.request<WbcDetail>('GET', `/api/wbc/sessions/${encodeURIComponent(sid)}`);
  }

  /** Its turns, newest last: the newest `limit`, or those before `before` (the answer's own `before`). */
  wbcTurns(sid: string, limit: number, before?: number | null): Promise<WbcTurnsPage> {
    const back = before ? `&before=${encodeURIComponent(String(before))}` : '';
    return this.request<WbcTurnsPage>('GET', `/api/wbc/sessions/${encodeURIComponent(sid)}/turns?limit=${limit}${back}`);
  }

  /**
   * A line for the session, typed into its terminal when Claude is at its
   * prompt: JSON `{text}`, or with pictures a form of `text` and `images`
   * (the server checks each by its bytes: png, jpeg, gif or webp, 5 MB).
   */
  async wbcSend(sid: string, text: string, pictures: UploadPart[] = []): Promise<WbcMessage> {
    const path = `/api/wbc/sessions/${encodeURIComponent(sid)}/messages`;
    if (!pictures.length) return this.request<WbcMessage>('POST', path, { text });
    const form = new FormData();
    form.append('text', text);
    for (const p of pictures) {
      if ('blob' in p) form.append('images', p.blob, p.name);
      // React Native's FormData takes a {uri, name, type} part for a file on disk.
      else form.append('images', { uri: p.uri, name: p.name, type: p.type } as unknown as Blob);
    }
    const res = await this.send(
      path,
      { method: 'POST', body: form, headers: { Accept: 'application/json', [CSRF_HEADER]: '1' } },
      UPLOAD_TIMEOUT_MS,
    );
    return this.read<WbcMessage>(res, path);
  }

  /** Where a turn's picture is (`req`, `n` from its `images`). */
  wbcTurnImagePath(sid: string, req: string, n: number): string {
    return `/api/wbc/sessions/${encodeURIComponent(sid)}/images/${encodeURIComponent(req)}/${n}`;
  }

  /** Where a picture sent with a message is. */
  wbcMessageImagePath(sid: string, mid: string, n: number): string {
    return `/api/wbc/sessions/${encodeURIComponent(sid)}/messages/${encodeURIComponent(mid)}/images/${n}`;
  }

  /**
   * One of those pictures as a data: URI, read with this account's session
   * (a browser's <img> could not send it); 'gone' when it is no longer kept
   * (404), null when it could not be read now.
   */
  async wbcImage(path: string): Promise<string | 'gone' | null> {
    const res = await this.send(path, { headers: { Accept: 'image/*' } }, UPLOAD_TIMEOUT_MS);
    if (res.status === 404) return 'gone';
    if (!res.ok) {
      if (res.status === 401) this.deps.onUnauthorized?.();
      return null;
    }
    return blobToDataUri(await res.blob());
  }

  // ---- files --------------------------------------------------------------

  /**
   * Every upload of the workspace; the app's own (In the app) carry `where`.
   * `own` asks for one's own only (`?area=own`); an older server ignores it
   * and answers all of them, so the caller still keeps only those without
   * `where` (lib/files.ts mine).
   */
  listFiles(own = false): Promise<StoredFile[]> {
    return this.request<StoredFile[]>('GET', own ? '/api/files?area=own' : '/api/files');
  }

  folders(): Promise<FileFolder[]> {
    return this.request<FileFolder[]>('GET', '/api/files/folders');
  }

  /** The read-only folders: Projects, Chat, Parts, Agents, Taste. */
  virtualTree(): Promise<VirtualTree> {
    return this.request<VirtualTree>('GET', '/api/files/virtual');
  }

  /**
   * One read-only folder ("" the roots), with the uploads its links refer
   * to (`?under=`). An older server ignores `under` and answers the whole
   * tree: that comes back as `{ tree }`, for the caller to work as before.
   */
  async virtualFolder(under: string): Promise<{ folder: VirtualFolder } | { tree: VirtualTree }> {
    const got = await this.request<VirtualFolder | VirtualTree>(
      'GET',
      `/api/files/virtual?under=${encodeURIComponent(under)}`,
    );
    if (got && typeof (got as VirtualFolder).under === 'string' && Array.isArray((got as VirtualFolder).linked)) {
      return { folder: got as VirtualFolder };
    }
    return { tree: got as VirtualTree };
  }

  filesTrash(): Promise<{ days: number; files: TrashFile[] }> {
    return this.request('GET', '/api/files/trash');
  }

  restoreFiles(
    ids: string[],
  ): Promise<{ restored: StoredFile[]; refused: { id: string; name: string; why: string }[] }> {
    return this.request('POST', '/api/files/trash/restore', { files: ids });
  }

  purgeFiles(ids: string[]): Promise<{ purged: string[] }> {
    return this.request('POST', '/api/files/trash/purge', { files: ids });
  }

  renameFile(id: string, name: string): Promise<StoredFile> {
    return this.request<StoredFile>('PATCH', `/api/files/${encodeURIComponent(id)}`, { name: name.trim() });
  }

  /** Into Deleted files, kept there for the server's days (30 by default). */
  deleteFile(id: string): Promise<{ deleted: string }> {
    return this.request('DELETE', `/api/files/${encodeURIComponent(id)}`);
  }

  moveFiles(files: string[], folders: string[], to: string): Promise<{ files: number; folders: number }> {
    return this.request('POST', '/api/files/move', { files, folders, to });
  }

  /** A copy of any file - one the app made, too - into one's own folders: the one way it reaches My files. */
  copyToMine(id: string, folder = ''): Promise<StoredFile> {
    return this.request<StoredFile>('POST', `/api/files/${encodeURIComponent(id)}/copy`, { folder });
  }

  makeFolder(name: string, parent: string): Promise<FileFolder> {
    return this.request<FileFolder>('POST', '/api/files/folders', { name: name.trim(), parent });
  }

  renameFolder(id: string, name: string): Promise<FileFolder> {
    return this.request<FileFolder>('PATCH', `/api/files/folders/${encodeURIComponent(id)}`, { name: name.trim() });
  }

  /** A folder and, with `contents`, everything in it (only if every file in it is one's to delete). */
  deleteFolder(id: string, contents: boolean): Promise<{ deleted: string; files?: number; folders?: number }> {
    return this.request('DELETE', `/api/files/folders/${encodeURIComponent(id)}?contents=${contents}`);
  }

  /** Files from the phone into a folder of My files ("" the top). */
  async upload(parts: UploadPart[], folder: string): Promise<StoredFile[]> {
    const form = new FormData();
    for (const p of parts) {
      if ('blob' in p) form.append('upload', p.blob, p.name);
      // React Native's FormData takes a {uri, name, type} part for a file on disk.
      else form.append('upload', { uri: p.uri, name: p.name, type: p.type } as unknown as Blob);
    }
    form.append('context', JSON.stringify({ room: 'files' }));
    form.append('note', '');
    form.append('folder', folder);
    const res = await this.send(
      '/api/files',
      { method: 'POST', body: form, headers: { [CSRF_HEADER]: '1' } },
      UPLOAD_TIMEOUT_MS,
    );
    return this.read<StoredFile[]>(res, '/api/files');
  }

  /** The address of a file's bytes (`inline` to show it rather than save it). */
  fileUrl(id: string, inline = false): string {
    return this.url(`/api/files/${encodeURIComponent(id)}${inline ? '?inline=1' : ''}`);
  }

  /**
   * A picture made `px` a side at most by the server (GET
   * /api/files/{id}/thumb?px=, one of its sizes), as a data: URI - so a
   * photo is not downloaded whole to be shown on a phone. null when the
   * server has no such size (an older one answers its small grid picture
   * without `X-Thumb-Px`, or 404/400/422): show the original instead.
   */
  async previewUri(id: string, px: number): Promise<string | null> {
    const path = `/api/files/${encodeURIComponent(id)}/thumb?px=${Math.round(px)}`;
    const res = await this.send(path, { headers: { Accept: 'image/webp,image/jpeg,image/*' } });
    if (!res.ok || !res.headers.get('x-thumb-px')) {
      if (res.status === 401) this.deps.onUnauthorized?.();
      return null;
    }
    return blobToDataUri(await res.blob());
  }

  /** Page n (from 1) of a PDF as a picture, drawn by the server. */
  pdfPageUrl(id: string, n: number, dpi = 110): string {
    return this.url(`/api/files/${encodeURIComponent(id)}/pdf/page/${n}.png?dpi=${dpi}`);
  }

  /** How many pages a PDF has (its first page's text comes with the count). */
  async pdfPages(id: string): Promise<number> {
    const got = await this.request<{ count: number }>('GET', `/api/files/${encodeURIComponent(id)}/pdf?pages=1`);
    return got.count;
  }

  table(id: string): Promise<TableData> {
    return this.request<TableData>('GET', `/api/files/${encodeURIComponent(id)}/table`);
  }

  /** The first `max` bytes of a file as text (an HTTP Range request). */
  async fileText(id: string, max = 256 * 1024): Promise<TextHead> {
    const path = `/api/files/${encodeURIComponent(id)}?inline=1`;
    const res = await this.send(path, { headers: { Range: `bytes=0-${max - 1}` } });
    if (!res.ok) return this.read<TextHead>(res, path);
    const text = await res.text();
    const total = Number((res.headers.get('content-range') || '').split('/')[1]);
    return { text, cut: res.status === 206 && Number.isFinite(total) && total > max };
  }

  /** A file's bytes, to hand to another app or keep on the phone. */
  async fileBlob(id: string): Promise<Blob> {
    const path = `/api/files/${encodeURIComponent(id)}`;
    const res = await this.send(path, {}, UPLOAD_TIMEOUT_MS);
    if (!res.ok) return this.read<Blob>(res, path);
    return res.blob();
  }

  /**
   * A row's small picture, as a data: URI. The server makes it the first
   * time it is asked for (202 while it does: ask again after `seconds`);
   * 404 is a file that keeps its icon.
   */
  async mini(id: string): Promise<Mini> {
    const path = `/api/files/${encodeURIComponent(id)}/mini?wait=1.5`;
    const res = await this.send(path, { headers: { Accept: 'image/webp,image/*' } });
    if (res.status === 202) {
      const after = Number(res.headers.get('retry-after'));
      return { state: 'later', seconds: Number.isFinite(after) && after > 0 ? Math.min(after, 30) : 2 };
    }
    if (!res.ok) {
      if (res.status === 401) this.deps.onUnauthorized?.();
      return { state: 'none' };
    }
    return { state: 'ready', uri: await blobToDataUri(await res.blob()) };
  }

  /** Someone's picture (one's own, here) as a data URI; null when there is none. */
  async avatar(userId: string, v?: number | string | null): Promise<string | null> {
    const path = `/api/me/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(String(v ?? ''))}`;
    const res = await this.send(path, { headers: { Accept: 'image/*' } });
    if (!res.ok) return null;
    return blobToDataUri(await res.blob());
  }

  /** A raw request with the session, the timeout and the app's own errors - for answers that are not JSON. */
  private async send(path: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await this.fetchImpl(this.url(path), {
        method: 'GET',
        credentials: 'include',
        ...init,
        headers: { ...((init.headers as Record<string, string>) ?? {}), ...this.auth() },
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
        headers: { Accept: 'application/json', [CSRF_HEADER]: '1', ...this.auth() },
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
