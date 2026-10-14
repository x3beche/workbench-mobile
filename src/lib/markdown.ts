/**
 * A small Markdown reader for chat answers: the parts models actually use.
 * Headings, paragraphs, bullet and numbered lists, block quotes, fenced code,
 * rules and tables (kept as monospaced text); inline code, bold, italic and
 * links. Anything else stays as written - nothing is ever dropped.
 * Pure: it returns a tree, the view (components/Markdown.tsx) draws it.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] };

export type Block =
  | { kind: 'heading'; level: number; children: Inline[] }
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { kind: 'quote'; children: Inline[] }
  | { kind: 'rule' }
  | { kind: 'table'; text: string };

const FENCE = /^\s{0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE = /^\s*\|.*\|\s*$/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(FENCE);
    if (fence) {
      const close = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(close)) body.push(lines[i++]);
      i++; // the closing fence (or the end, while an answer is still being written)
      blocks.push({ kind: 'code', lang: fence[2] || '', text: body.join('\n') });
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, children: parseInline(heading[2]) });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    if (TABLE.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && TABLE.test(lines[i])) rows.push(lines[i++].trim());
      blocks.push({ kind: 'table', text: rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r)).join('\n') });
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      let m: RegExpMatchArray | null;
      while (i < lines.length && (m = lines[i].match(QUOTE))) {
        body.push(m[1]);
        i++;
      }
      blocks.push({ kind: 'quote', children: parseInline(body.join('\n')) });
      continue;
    }
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    if (bullet || numbered) {
      const ordered = !bullet;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = ordered ? l.match(NUMBERED) : l.match(BULLET);
        if (m) {
          items.push(ordered ? m[2] : m[1]);
          i++;
        } else if (l.trim() && /^\s{2,}\S/.test(l) && items.length) {
          // A continuation (or a nested item): kept with the item above.
          items[items.length - 1] += '\n' + l.trim();
          i++;
        } else break;
      }
      blocks.push({
        kind: 'list',
        ordered,
        start: ordered && numbered ? parseInt(numbered[1], 10) : 1,
        items: items.map(parseInline),
      });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !FENCE.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !TABLE.test(lines[i]) &&
      !RULE.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push({ kind: 'paragraph', children: parseInline(para.join('\n')) });
  }
  return blocks;
}

const SAFE_HREF = /^(https?:|mailto:)/i;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ kind: 'text', text });
    text = '';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length && /[\\`*_[\]()#>-]/.test(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }
    if (c === '`') {
      const ticks = src.slice(i).match(/^`+/)![0];
      const end = src.indexOf(ticks, i + ticks.length);
      if (end > 0) {
        flush();
        out.push({ kind: 'code', text: src.slice(i + ticks.length, end).trim() || src.slice(i + ticks.length, end) });
        i = end + ticks.length;
        continue;
      }
    }
    if ((c === '*' || c === '_') && src[i + 1] === c) {
      const end = src.indexOf(c + c, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: 'strong', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (c === '*' || (c === '_' && (i === 0 || /\W/.test(src[i - 1])))) {
      const end = findEmphasisEnd(src, i + 1, c);
      if (end > i + 1 && !/\s/.test(src[i + 1])) {
        flush();
        out.push({ kind: 'em', children: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (c === '[') {
      const m = src.slice(i).match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
      if (m) {
        flush();
        if (SAFE_HREF.test(m[2])) out.push({ kind: 'link', href: m[2], children: parseInline(m[1]) });
        else out.push(...parseInline(m[1]));
        i += m[0].length;
        continue;
      }
    }
    text += c;
    i++;
  }
  flush();
  return out;
}

function findEmphasisEnd(src: string, from: number, mark: string): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\n' && src[j + 1] === '\n') return -1;
    if (src[j] === mark && src[j + 1] !== mark && src[j - 1] !== mark && !/\s/.test(src[j - 1])) {
      if (mark === '_' && j + 1 < src.length && /\w/.test(src[j + 1])) continue;
      return j;
    }
  }
  return -1;
}

/** The plain words of some inlines, for accessibility labels and previews. */
export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => ('children' in n ? inlineText(n.children) : n.text)).join('');
}
