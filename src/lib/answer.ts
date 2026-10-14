/**
 * A conversation on screen, as the events of an answer change it.
 * The same events come from POST /messages (one's own answer) and from
 * GET /live (anyone's, after a reconnect): backend/cc_chat.py.
 */
import type { ChatEvent, ChatMessage } from '../api/types';

export interface Writing {
  gen: string | null;
  text: string;
  thinking: string;
  error: string | null;
}

export interface ConversationView {
  title: string;
  messages: ChatMessage[];
  /** The answer being written, as far as it got. */
  writing: Writing | null;
  /** Pieces were missed: the conversation should be read again from the server. */
  stale: boolean;
}

/**
 * `have` with a piece that goes at `at` in the whole. A piece the view has
 * already is skipped; null when pieces before it never came.
 */
export function fit(have: string, text: string, at?: number): string | null {
  if (at == null || at === have.length) return have + text;
  if (at < have.length) {
    const whole = have.slice(0, at) + text;
    return whole.length >= have.length ? whole : have;
  }
  return null;
}

const empty = (gen: string | null = null): Writing => ({ gen, text: '', thinking: '', error: null });

export function applyEvent(view: ConversationView, ev: ChatEvent): ConversationView {
  switch (ev.type) {
    case 'user': {
      const keep = typeof ev.keep === 'number' ? ev.keep : view.messages.length;
      const messages = view.messages.slice(0, keep);
      if (ev.message) messages.push(ev.message);
      return { ...view, messages, writing: empty(ev.gen ?? null) };
    }
    case 'hello': {
      const now = ev.live?.[0];
      if (!now) return view.writing ? { ...view, writing: null, stale: true } : view;
      return { ...view, writing: { gen: now.gen, text: now.text || '', thinking: now.thinking || '', error: null } };
    }
    case 'start': {
      if (view.writing && view.writing.gen === ev.gen && view.writing.text) return view;
      return {
        ...view,
        writing: { gen: ev.gen ?? null, text: ev.text || '', thinking: ev.thinking || '', error: null },
      };
    }
    case 'text':
    case 'thinking': {
      const w = view.writing ?? empty(ev.gen ?? null);
      if (ev.gen && w.gen && ev.gen !== w.gen) return view;
      const key = ev.type === 'text' ? 'text' : 'thinking';
      const next = fit(w[key], ev.text || '', ev.at);
      if (next === null) return { ...view, stale: true };
      return { ...view, writing: { ...w, [key]: next } };
    }
    case 'error': {
      const w = view.writing ?? empty(ev.gen ?? null);
      return { ...view, writing: { ...w, error: ev.error || 'The answer failed.' } };
    }
    case 'done': {
      const messages = ev.message ? [...view.messages, ev.message] : view.messages;
      return { ...view, messages, writing: null, stale: view.stale || !ev.message };
    }
    case 'title':
      return ev.title ? { ...view, title: ev.title } : view;
    case 'end':
      // An end without its done: the answer is in the conversation now, read it.
      return view.writing ? { ...view, writing: null, stale: true } : view;
    default:
      return view;
  }
}
