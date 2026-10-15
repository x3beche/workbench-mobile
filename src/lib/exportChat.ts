/**
 * A conversation written out to keep or send: Markdown as it was said, or an
 * HTML page (for a PDF) with the answers' Markdown laid out. The server has
 * no export route (SERVER-CHANGES.md), so the app writes these from the
 * conversation it reads (GET /api/cc/chats/{id}). Pure.
 */
import type { Chat, ChatMessage } from '../api/types';
import { parseMarkdown, type Block, type Inline } from './markdown';

function when(iso: string | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

function speaker(m: ChatMessage): string {
  if (m.role === 'user') return m.by?.name || 'You';
  const model = (m.model || '').split('/').pop();
  return model || 'Answer';
}

/** What a line said: its text, or why it has none. */
function body(m: ChatMessage): string {
  const text = (m.content || '').trim();
  if (text) return text;
  if (m.error) return `(failed: ${m.error})`;
  return m.stopped ? '(stopped)' : '';
}

/** A file name from the title: letters, digits, spaces and dashes, at most 60 characters. */
export function exportName(chat: Pick<Chat, 'title'>, ext: string): string {
  const base =
    (chat.title || 'Conversation')
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60) || 'Conversation';
  return `${base}.${ext}`;
}

export function chatToMarkdown(chat: Chat): string {
  const out = [`# ${chat.title || 'Conversation'}`, ''];
  const model = chat.model ? ` · ${chat.model}` : '';
  out.push(`_${when(chat.created_at)}${model}_`, '');
  for (const m of chat.messages ?? []) {
    out.push(`## ${speaker(m)} · ${when(m.at)}`, '', body(m), '');
  }
  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.kind) {
        case 'text':
          return esc(n.text);
        case 'code':
          return `<code>${esc(n.text)}</code>`;
        case 'strong':
          return `<strong>${inline(n.children)}</strong>`;
        case 'em':
          return `<em>${inline(n.children)}</em>`;
        case 'link':
          return /^https?:\/\//i.test(n.href)
            ? `<a href="${esc(n.href)}">${inline(n.children)}</a>`
            : inline(n.children);
      }
      return '';
    })
    .join('');
}

function block(b: Block): string {
  switch (b.kind) {
    case 'heading': {
      const level = Math.min(6, b.level + 2);
      return `<h${level}>${inline(b.children)}</h${level}>`;
    }
    case 'paragraph':
      return `<p>${inline(b.children)}</p>`;
    case 'code':
    case 'table':
      return `<pre>${esc(b.text)}</pre>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
      return `<${tag}${start}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`;
    }
    case 'quote':
      return `<blockquote>${inline(b.children)}</blockquote>`;
    case 'rule':
      return '<hr>';
  }
  return '';
}

/** A plain printable page: black on white, IBM Plex if the device has it, a hairline between lines. */
export function chatToHtml(chat: Chat): string {
  const lines = (chat.messages ?? [])
    .map((m) => {
      const html =
        m.role === 'user'
          ? `<p>${esc(body(m)).replace(/\n/g, '<br>')}</p>`
          : parseMarkdown(body(m)).map(block).join('\n');
      return `<section><div class="who">${esc(speaker(m))} <span>${esc(when(m.at))}</span></div>${html}</section>`;
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(chat.title || 'Conversation')}</title><style>
body{font-family:"IBM Plex Sans",-apple-system,Roboto,"Segoe UI",sans-serif;font-size:11pt;line-height:1.5;color:#18181b;margin:28px}
h1{font-size:17pt;margin:0 0 2px}.meta{color:#71717a;font-size:9pt;margin-bottom:18px}
section{border-top:1px solid #e4e4e7;padding:10px 0}.who{font-weight:600;font-size:10pt;margin-bottom:4px}.who span{font-weight:400;color:#71717a}
pre{font-family:"IBM Plex Mono",Menlo,monospace;font-size:9pt;background:#f4f4f5;padding:8px;border-radius:4px;white-space:pre-wrap;word-break:break-word}
code{font-family:"IBM Plex Mono",Menlo,monospace;font-size:9.5pt}blockquote{margin:0;padding-left:10px;color:#52525b}
h3,h4,h5,h6{font-size:11.5pt;margin:10px 0 4px}p{margin:4px 0}ul,ol{margin:4px 0;padding-left:20px}a{color:#18181b}
</style></head><body><h1>${esc(chat.title || 'Conversation')}</h1><div class="meta">${esc(when(chat.created_at))}${chat.model ? ` · ${esc(chat.model)}` : ''}</div>
${lines}
</body></html>`;
}
