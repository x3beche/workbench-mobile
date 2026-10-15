/** Shapes the Workbench server answers with (backend/main.py, backend/cc_chat.py). */

export interface User {
  id: string;
  name?: string | null;
  email?: string;
}

export interface AuthState {
  /** "on": sign-in is required. "off": local mode, everyone is the owner. */
  mode: 'on' | 'off';
  needs_setup?: boolean;
  user: User | null;
  role: string | null;
  /** What this role may do (backend/access.py ACTIONS): view, draw, run, edit, delete, ... */
  can?: string[];
  must_change_password?: boolean;
}

export interface Who {
  id?: string;
  name?: string;
  type?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
  by?: Who;
  provider?: string;
  model?: string;
  thinking?: string;
  error?: string;
  stopped?: boolean;
  interrupted?: boolean;
  edited_at?: string;
  /** The tools the model ran for this answer, where they happened in it. */
  steps?: Step[];
}

/**
 * One tool the model ran while writing an answer (backend/ccgen.py run_step).
 * `say` is a sentence with {name} slots filled from `vars`; `pos` is where in
 * the answer's text it ran.
 */
export interface Step {
  id: string;
  tool: string;
  status: 'running' | 'done' | 'error' | 'ask' | 'denied' | 'stopped' | 'interrupted' | string;
  pos?: number;
  say?: string;
  vars?: Record<string, string | number>;
  summary?: string;
  error?: string;
  ms?: number;
}

export interface Chat {
  id: string;
  title: string;
  provider: string;
  model: string;
  by?: Who;
  created_at: string;
  updated_at: string;
  count: number;
  pinned?: boolean;
  archived?: boolean;
  messages?: ChatMessage[];
  last?: { role: string; text: string; by?: string };
  /** The answer being written in it, if any. */
  gen?: string | null;
  /** In the trash: when it was deleted, and the whole days left before it goes for good. */
  deleted_at?: string;
  purge_at?: string;
  days_left?: number;
}

/** Which conversations a list shows: the live ones, the archived ones, or the trash. */
export type ChatScope = 'live' | 'archived' | 'trash';

export interface Provider {
  id: string;
  name: string;
  /** A key is set on the server: the provider can answer. */
  set: boolean;
}

export interface Model {
  id: string;
  name: string;
  context?: number | null;
  cheap?: boolean;
}

/** One server-sent event of an answer being written (cc_chat._begin / live). */
export interface ChatEvent {
  type: string;
  text?: string;
  at?: number;
  error?: string;
  message?: ChatMessage | null;
  keep?: number;
  title?: string;
  gen?: string;
  live?: { gen: string; text?: string; thinking?: string; model?: string; steps?: Step[] }[];
  thinking?: string;
  steps?: Step[];
}

/**
 * The empty Chat's example questions (GET /api/cc/ideas, backend/chat_ideas.py):
 * written by a model from the person's own work, or none yet (`default`).
 * `start` is the model a new conversation begins with.
 */
export interface Ideas {
  items: { kind: string; text: string }[];
  source: 'llm' | 'default';
  start?: { provider: string; model: string };
}

/** 202 from POST /messages: an answer was being written, so the line waits. */
export interface Queued {
  queued?: { id: string; content: string };
  queue?: unknown[];
  paused?: boolean;
}

export interface Transcript {
  text: string;
  language: string;
  model: string;
  seconds: number;
}

// ---- Files (backend/files_api.py, backend/files_virtual.py) ---------------

/** How the server previews a file (files.preview_of). */
export type Preview =
  'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'table' | 'archive' | 'mesh' | 'step' | 'text' | 'none';

export interface StoredFile {
  id: string;
  name: string;
  bytes: number;
  kind: string;
  content_type?: string;
  preview: Preview;
  folder: string;
  created_at: string;
  by?: Who;
  note?: string;
  sha256?: string;
  context?: Record<string, string>;
  /** One of what the app keeps (In the app): read-only here; `where` is the area that changes it. */
  ro?: boolean;
  where?: string;
}

export interface FileFolder {
  id: string;
  name: string;
  parent: string;
  path?: string;
  by?: Who;
  created_at?: string;
  /** A read-only folder (In the app); `root` for Projects, Chat, Parts, Agents and Taste. */
  ro?: boolean;
  root?: boolean;
  where?: string;
  /** What a read-only folder holds itself, when the server read it one folder at a time (`?under=`). */
  count?: { folders: number; files: number };
}

/** GET /api/files/virtual: the read-only folders, their own files, and which uploads they refer to. */
export interface VirtualTree {
  folders: FileFolder[];
  files: StoredFile[];
  links: { folder: string; file: string }[];
}

/**
 * GET /api/files/virtual?under=: one read-only folder ("" the roots) - the
 * folders in it, each with what it holds itself (`count`), its own files,
 * its links and the uploads they refer to (`linked`), and the way to it
 * from the top (`trail`).
 */
export interface VirtualFolder {
  under: string;
  trail: { id: string; name: string }[];
  folders: FileFolder[];
  files: StoredFile[];
  links: { folder: string; file: string }[];
  linked: StoredFile[];
}

/** A file in Files' trash (GET /api/files/trash). */
export interface TrashFile extends StoredFile {
  deleted_at: string;
  deleted_by?: Who;
  purge_at: string;
  folder_path: string;
  days_left: number | null;
}

/** A file picked on the phone to upload: a uri on Android and iOS, a Blob in a browser. */
export type UploadPart = { uri: string; name: string; type: string } | { blob: Blob; name: string };
