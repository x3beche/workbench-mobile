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
}

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
