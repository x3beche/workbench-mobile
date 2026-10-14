import { inlineText, parseInline, parseMarkdown, type Block, type Inline } from '../markdown';

function childrenOf(b: Block): Inline[] {
  if (!('children' in b)) throw new Error(`${b.kind} has no children`);
  return b.children;
}

function itemsOf(b: Block): Inline[][] {
  if (b.kind !== 'list') throw new Error(`${b.kind} is not a list`);
  return b.items;
}

describe('parseInline', () => {
  it('reads code, bold, italic and links', () => {
    expect(parseInline('a `b` **c** *d* _e_ [f](https://x.org)')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'code', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'c' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'd' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'e' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: 'https://x.org', children: [{ kind: 'text', text: 'f' }] },
    ]);
  });

  it('nests emphasis in bold', () => {
    expect(parseInline('**a *b***')[0]).toMatchObject({ kind: 'strong' });
  });

  it('keeps underscores inside words', () => {
    expect(parseInline('snake_case_name')).toEqual([{ kind: 'text', text: 'snake_case_name' }]);
  });

  it('keeps an unclosed mark as written (an answer still being written)', () => {
    expect(inlineText(parseInline('**half'))).toBe('**half');
    expect(inlineText(parseInline('`open'))).toBe('`open');
    expect(inlineText(parseInline('2 * 3 = 6'))).toBe('2 * 3 = 6');
  });

  it('drops a link to an unsafe scheme but keeps its words', () => {
    expect(parseInline('[click](javascript:alert) [x](data:text/html,hi)')).toEqual([
      { kind: 'text', text: 'click' },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'x' },
    ]);
  });

  it('honours backslash escapes', () => {
    expect(parseInline('\\*not em\\*')).toEqual([{ kind: 'text', text: '*not em*' }]);
  });

  it('reads double-backtick code holding a backtick', () => {
    expect(parseInline('``a ` b``')).toEqual([{ kind: 'code', text: 'a ` b' }]);
  });
});

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and rules', () => {
    const got = parseMarkdown('# Title\n\nOne line\nnext line\n\n---\n\n### Small ###');
    expect(got.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'rule', 'heading']);
    expect(got[0]).toMatchObject({ level: 1 });
    expect(inlineText(childrenOf(got[1]))).toBe('One line\nnext line');
    expect(got[3]).toMatchObject({ level: 3, children: [{ kind: 'text', text: 'Small' }] });
  });

  it('reads fenced code with its language, untouched', () => {
    expect(parseMarkdown('```ts\nconst a = **1**;\n\nx\n```\nafter')).toEqual([
      { kind: 'code', lang: 'ts', text: 'const a = **1**;\n\nx' },
      { kind: 'paragraph', children: [{ kind: 'text', text: 'after' }] },
    ]);
  });

  it('shows an unclosed fence as code to the end', () => {
    expect(parseMarkdown('```\nhalf written')).toEqual([{ kind: 'code', lang: '', text: 'half written' }]);
  });

  it('reads bullet and numbered lists, with continuations', () => {
    const [bullets, numbers] = parseMarkdown('- one\n- two\n  more\n\n3. c\n4) d');
    expect(bullets).toMatchObject({ kind: 'list', ordered: false, start: 1 });
    expect(itemsOf(bullets).map(inlineText)).toEqual(['one', 'two\nmore']);
    expect(numbers).toMatchObject({ kind: 'list', ordered: true, start: 3 });
    expect(itemsOf(numbers).map(inlineText)).toEqual(['c', 'd']);
  });

  it('reads quotes', () => {
    expect(parseMarkdown('> a\n> b')).toEqual([{ kind: 'quote', children: [{ kind: 'text', text: 'a\nb' }] }]);
  });

  it('keeps tables as text, without the separator row', () => {
    expect(parseMarkdown('| a | b |\n|---|:-:|\n| 1 | 2 |')).toEqual([{ kind: 'table', text: '| a | b |\n| 1 | 2 |' }]);
  });

  it('handles CRLF and an empty text', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('a\r\n\r\nb').map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
  });
});
