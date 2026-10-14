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
  live?: { gen: string; text?: string; thinking?: string; model?: string }[];
  thinking?: string;
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
