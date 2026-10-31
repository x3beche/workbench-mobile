/// <reference types="node" />
/// (the tables are read from disk, and tsconfig names only "jest" in `types`)
/**
 * The words tables: one entry per key, in each language.
 *
 * English is the key, and a second `name:` in the same object literal wins
 * over the first without a word - the screen keeps the newer English and
 * loses the older Turkish. TypeScript usually refuses a repeated property,
 * but a table typed as `Record<string, string>` does not, so this reads the
 * sources as they are written and says which key repeats and where.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..', '..');
const DIRS = ['src/lib', 'src/components'].map((d) => path.join(ROOT, d));
const FILES = DIRS.flatMap((dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('Strings.ts'))
    .map((f) => path.join(dir, f)),
)
  .filter((f) => !f.includes('__tests__'))
  .sort();

/** The source with comments emptied out, line numbers kept. */
function withoutComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '`') {
      // A template: its own words are never keys, and its `${...}` may hold
      // quotes that would otherwise be read as one. Blanked, not dropped.
      const end = endOfTemplate(src, i);
      out += src.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
    } else if (c === "'" || c === '"') {
      const end = endOfString(src, i);
      out += src.slice(i, end);
      i = end;
    } else if (src.startsWith('//', i)) {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** The index just past the template literal that starts at `i`. */
function endOfTemplate(src: string, i: number): number {
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') {
      j += 2;
      continue;
    }
    if (src[j] === '`') return j + 1;
    if (src.startsWith('${', j)) {
      // Its expression may hold strings, templates and braces of its own.
      let depth = 1;
      j += 2;
      while (j < src.length && depth > 0) {
        if (src[j] === "'" || src[j] === '"') j = endOfString(src, j);
        else if (src[j] === '`') j = endOfTemplate(src, j);
        else if (src[j] === '{') {
          depth += 1;
          j += 1;
        } else if (src[j] === '}') {
          depth -= 1;
          j += 1;
        } else j += 1;
      }
      continue;
    }
    j += 1;
  }
  throw new Error(`a template is never closed at ${i}`);
}

/** The index just past the string that starts at `i`. */
function endOfString(src: string, i: number): number {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') {
      j += 2;
      continue;
    }
    if (src[j] === quote) return j + 1;
    j += 1;
  }
  throw new Error(`a string is never closed at ${i}`);
}

function lineOf(code: string, at: number): number {
  return code.slice(0, at).split('\n').length;
}

type Key = { key: string; line: number };

/** Every `key: value` at the top level of the object literal at `open`. */
function keysOf(code: string, open: number): Key[] {
  const out: Key[] = [];
  let i = open + 1;
  let depth = 1;
  let parens = 0;
  let brackets = 0;
  let fresh = true; // nothing but a comma (or the brace) since the last entry
  while (i < code.length) {
    while (i < code.length && /\s/.test(code[i])) i += 1;
    if (i >= code.length) break;
    const c = code[i];
    if (c === '}') {
      depth -= 1;
      i += 1;
      if (depth === 0) break;
      fresh = false;
      continue;
    }
    if (c === '{') {
      depth += 1;
      i += 1;
      fresh = false;
      continue;
    }
    if (c === '(') parens += 1;
    else if (c === ')') parens -= 1;
    else if (c === '[') brackets += 1;
    else if (c === ']') brackets -= 1;
    if (c === ',') {
      i += 1;
      fresh = depth === 1 && parens === 0 && brackets === 0;
      continue;
    }
    const top = depth === 1 && parens === 0 && brackets === 0;
    if (c === "'" || c === '"') {
      const start = i;
      const end = endOfString(code, i);
      i = end;
      if (fresh && top) {
        let j = i;
        while (j < code.length && /\s/.test(code[j])) j += 1;
        if (code[j] === ':') out.push({ key: code.slice(start + 1, end - 1), line: lineOf(code, start) });
      }
      fresh = false;
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*\s*:(?!:)/.exec(code.slice(i));
    if (word) {
      if (fresh && top) out.push({ key: word[0].replace(/\s*:$/, ''), line: lineOf(code, i) });
      i += word[0].length;
      fresh = false;
      continue;
    }
    fresh = false;
    i += 1;
  }
  return out;
}

type Entry = Key & { lang: string };

/** (language, key, line) for every table in one file's source. */
function entriesOfSource(src: string): Entry[] {
  const code = withoutComments(src);
  const rows: Entry[] = [];
  const decl = /const\s+(en|tr)\b[^=]*=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(code))) {
    const open = code.indexOf('{', m.index + m[0].length - 1);
    for (const k of keysOf(code, open)) rows.push({ ...k, lang: m[1] });
  }
  return rows;
}

/** The keys written more than once in one table of one file. */
function repeats(file: string, rows: Entry[]): string[] {
  const seen = new Map<string, number[]>();
  for (const r of rows) {
    const id = `${r.lang}:${r.key}`;
    seen.set(id, [...(seen.get(id) ?? []), r.line]);
  }
  return [...seen]
    .filter(([, lines]) => lines.length > 1)
    .map(([id, lines]) => `${path.basename(file)}: ${id} at lines ${lines.join(', ')}`);
}

describe('the words tables', () => {
  it('are found, in both languages, each with its keys', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(10);
    for (const file of FILES) {
      const rows = entriesOfSource(fs.readFileSync(file, 'utf8'));
      expect([path.basename(file), [...new Set(rows.map((r) => r.lang))].sort()]).toEqual([
        path.basename(file),
        ['en', 'tr'],
      ]);
      expect(rows.length).toBeGreaterThan(10);
    }
  });

  it('take a repeated key for a repeated key, and a comment for nothing', () => {
    const src = [
      'const en: X = {',
      "  // a comment naming another key: 'keep': 'other',",
      "  keep: 'Keep',",
      '  nested: { a: 1, a: 2 },',
      "  'same words': 'One',",
      "  keep: 'Hold',",
      '};',
    ].join('\n');
    const rows = entriesOfSource(src);
    expect(rows.map((r) => r.key)).toEqual(['keep', 'nested', 'same words', 'keep']);
    expect(repeats('x.ts', rows)).toEqual(['x.ts: en:keep at lines 3, 6']);
  });

  it('say no key twice', () => {
    const all = FILES.flatMap((file) => repeats(file, entriesOfSource(fs.readFileSync(file, 'utf8'))));
    expect(all).toEqual([]);
  });
});
