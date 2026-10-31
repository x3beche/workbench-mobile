/**
 * The app's contract with the server, checked against the answers it really got.
 *
 * Every file under src/api/__tests__/fixtures/contract/ is a response from the live server (how each was
 * taken, and what was scrubbed out of it, is in that folder's README). This reads the app's own types
 * (src/api/types.ts, src/update/release.ts) and walks a fixture against the type its manifest names:
 *
 *   - missing: a field the type says is there, and the answer does not send. The app reads undefined.
 *   - type:    a field sent as another thing than the type says (a number where the type says string, null
 *              where it says an object, ...).
 *   - array:   a list where the type says one thing, or something else where it says a list.
 *   - extra:   a field the server sends that the app does not type. Not an error - the app never reads it -
 *              but a rename shows up here beside the `missing` it caused, which is the drift worth seeing.
 *
 * From the command line: node scripts/contract-check.ts [fixtures folder]
 * From jest: import { checkFixtures } from '../../../scripts/contract-check'.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export type MismatchKind = 'missing' | 'type' | 'array' | 'extra';

export interface Mismatch {
  /** The fixture file the value came from. */
  fixture: string;
  /** The endpoint, as the manifest says it. */
  from: string;
  /** Where in the answer, as a dotted path (`session.computer.host`). */
  path: string;
  kind: MismatchKind;
  /** What the app's type says. */
  expected: string;
  /** What the answer had. */
  got: string;
}

interface Fixture {
  file: string;
  at?: string;
  type: string;
  from?: string;
}

export interface CheckResult {
  /** Things the app would read wrongly: a failure. */
  errors: Mismatch[];
  /** Fields the server sends that the app does not type: worth knowing, not a failure. */
  extras: Mismatch[];
  fixtures: number;
}

interface Ctx {
  decls: Map<string, ts.Node>;
  fixture: string;
  from: string;
}

interface Walked {
  errors: Mismatch[];
  extras: Mismatch[];
}

const ok = (): Walked => ({ errors: [], extras: [] });

/** The name of a property (an identifier, or a quoted key). */
function keyOf(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText();
}

/** Every member an interface has, its own and the ones it extends (a base type's fields are the answer's too). */
function membersOf(node: ts.InterfaceDeclaration, ctx: Ctx, seen = new Set<string>()): ts.TypeElement[] {
  const out: ts.TypeElement[] = [];
  for (const clause of node.heritageClauses ?? []) {
    for (const base of clause.types) {
      const name = base.expression.getText();
      if (seen.has(name)) continue;
      seen.add(name);
      const decl = ctx.decls.get(name);
      if (decl && ts.isInterfaceDeclaration(decl)) out.push(...membersOf(decl, ctx, seen));
    }
  }
  out.push(...node.members);
  return out;
}

/** The fields of a shape this checker can read as one object, or null when the type is something else. */
function membersOfType(node: ts.Node, ctx: Ctx): ts.TypeElement[] | null {
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) return membersOfType(node.type, ctx);
  if (ts.isTypeLiteralNode(node)) return [...node.members];
  if (ts.isIntersectionTypeNode(node)) {
    const parts = node.types.map((part) => membersOfType(part, ctx));
    return parts.every((p): p is ts.TypeElement[] => !!p) ? parts.flat() : null;
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    const decl = ctx.decls.get(name);
    if (decl && ts.isInterfaceDeclaration(decl)) return membersOf(decl, ctx);
  }
  return null;
}

function typeText(node: ts.Node | ts.TypeNode | undefined): string {
  return node ? node.getText() : '?';
}

function valueText(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'string') return `string(${JSON.stringify(value.length > 24 ? `${value.slice(0, 24)}…` : value)})`;
  if (typeof value === 'number') return `number(${value})`;
  if (typeof value === 'boolean') return `boolean(${value})`;
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function mismatch(ctx: Ctx, path: string, kind: MismatchKind, expected: string, got: string): Mismatch {
  return { fixture: ctx.fixture, from: ctx.from, path, kind, expected, got };
}

function walkNode(value: unknown, node: ts.Node, path: string, ctx: Ctx): Walked {
  if (ts.isInterfaceDeclaration(node)) return object(value, membersOf(node, ctx), path, ctx);
  if (ts.isTypeAliasDeclaration(node)) return walk(value, node.type, path, ctx);
  return walk(value, node as ts.TypeNode, path, ctx);
}

function walk(value: unknown, node: ts.TypeNode, path: string, ctx: Ctx): Walked {
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) return walk(value, node.type, path, ctx);

  // A union: the answer is one of them; the first that takes it whole is the one it is.
  if (ts.isUnionTypeNode(node)) {
    for (const part of node.types) {
      const got = walk(value, part, path, ctx);
      if (!got.errors.length) return got;
    }
    return { errors: [mismatch(ctx, path, 'type', typeText(node), valueText(value))], extras: [] };
  }

  if (ts.isIntersectionTypeNode(node)) {
    // An intersection of object shapes is one object with all their fields (checked together, so one part's
    // fields are not another part's "extra").
    const merged = node.types.map((part) => membersOfType(part, ctx));
    if (merged.every((m): m is ts.TypeElement[] => !!m)) return object(value, merged.flat(), path, ctx);
    const all = ok();
    for (const part of node.types) {
      const got = walk(value, part, path, ctx);
      all.errors.push(...got.errors);
      all.extras.push(...got.extras);
    }
    return all;
  }

  const kind = node.kind;
  if (kind === ts.SyntaxKind.AnyKeyword || kind === ts.SyntaxKind.UnknownKeyword) return ok();
  if (kind === ts.SyntaxKind.StringKeyword)
    return typeof value === 'string'
      ? ok()
      : { errors: [mismatch(ctx, path, 'type', 'string', valueText(value))], extras: [] };
  if (kind === ts.SyntaxKind.NumberKeyword)
    return typeof value === 'number'
      ? ok()
      : { errors: [mismatch(ctx, path, 'type', 'number', valueText(value))], extras: [] };
  if (kind === ts.SyntaxKind.BooleanKeyword)
    return typeof value === 'boolean'
      ? ok()
      : { errors: [mismatch(ctx, path, 'type', 'boolean', valueText(value))], extras: [] };
  if (kind === ts.SyntaxKind.NullKeyword)
    return value === null ? ok() : { errors: [mismatch(ctx, path, 'type', 'null', valueText(value))], extras: [] };
  if (kind === ts.SyntaxKind.UndefinedKeyword)
    return value === undefined ? ok() : { errors: [mismatch(ctx, path, 'type', 'undefined', valueText(value))], extras: [] };

  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal;
    const want =
      ts.isStringLiteral(lit) || ts.isNumericLiteral(lit)
        ? lit.text
        : lit.kind === ts.SyntaxKind.TrueKeyword
          ? true
          : lit.kind === ts.SyntaxKind.FalseKeyword
            ? false
            : lit.kind === ts.SyntaxKind.NullKeyword
              ? null
              : undefined;
    return value === want ? ok() : { errors: [mismatch(ctx, path, 'type', typeText(node), valueText(value))], extras: [] };
  }

  if (ts.isArrayTypeNode(node)) return array(value, node.elementType, path, ctx);
  if (ts.isTupleTypeNode(node)) {
    if (!Array.isArray(value)) return { errors: [mismatch(ctx, path, 'array', typeText(node), valueText(value))], extras: [] };
    if (value.length !== node.elements.length)
      return { errors: [mismatch(ctx, path, 'array', typeText(node), valueText(value))], extras: [] };
    const all = ok();
    node.elements.forEach((el, i) => {
      const got = walkNode(value[i], el, `${path}[${i}]`, ctx);
      all.errors.push(...got.errors);
      all.extras.push(...got.extras);
    });
    return all;
  }

  if (ts.isTypeLiteralNode(node)) return object(value, node.members, path, ctx);

  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    if (name === 'Array' || name === 'ReadonlyArray') return array(value, node.typeArguments![0], path, ctx);
    if (name === 'Record' && node.typeArguments?.length === 2) return record(value, node.typeArguments[1], path, ctx);
    const decl = ctx.decls.get(name);
    if (!decl) return ok(); // a type from elsewhere (Date, a lib type): not this contract's
    if (ts.isTypeAliasDeclaration(decl)) return walk(value, decl.type, path, ctx);
    if (ts.isInterfaceDeclaration(decl)) return object(value, membersOf(decl, ctx), path, ctx);
    return ok();
  }

  // A shape this checker does not know (a mapped type, keyof, ...): it says nothing rather than guessing.
  return ok();
}

function array(value: unknown, item: ts.Node, path: string, ctx: Ctx): Walked {
  if (!Array.isArray(value)) return { errors: [mismatch(ctx, path, 'array', `${typeText(item)}[]`, valueText(value))], extras: [] };
  const all = ok();
  value.forEach((v, i) => {
    const got = walkNode(v, item, `${path}[${i}]`, ctx);
    all.errors.push(...got.errors);
    all.extras.push(...got.extras);
  });
  return all;
}

function record(value: unknown, item: ts.Node, path: string, ctx: Ctx): Walked {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { errors: [mismatch(ctx, path, 'type', 'object', valueText(value))], extras: [] };
  const all = ok();
  for (const [k, v] of Object.entries(value)) {
    const got = walkNode(v, item, `${path}.${k}`, ctx);
    all.errors.push(...got.errors);
    all.extras.push(...got.extras);
  }
  return all;
}

function object(value: unknown, members: readonly ts.TypeElement[], path: string, ctx: Ctx): Walked {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { errors: [mismatch(ctx, path, 'type', 'object', valueText(value))], extras: [] };
  const fields = new Map<string, ts.PropertySignature>();
  let index: ts.IndexSignatureDeclaration | undefined;
  for (const m of members) {
    if (ts.isPropertySignature(m)) fields.set(keyOf(m.name), m);
    else if (ts.isIndexSignatureDeclaration(m)) index = m;
  }
  const all = ok();
  const seen = new Set<string>();
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    seen.add(key);
    const p = fields.get(key);
    if (!p) {
      if (index) {
        const got = walkNode(v, index.type, `${path}.${key}`, ctx);
        all.errors.push(...got.errors);
        all.extras.push(...got.extras);
      } else {
        all.extras.push(mismatch(ctx, `${path}.${key}`, 'extra', '(not in the app’s type)', valueText(v)));
      }
      continue;
    }
    if (!p.type) continue;
    const got = walk(v, p.type, `${path}.${key}`, ctx);
    all.errors.push(...got.errors);
    all.extras.push(...got.extras);
  }
  for (const [key, p] of fields) {
    if (!p.questionToken && p.type && !seen.has(key) && !index) {
      all.errors.push(mismatch(ctx, `${path}.${key}`, 'missing', typeText(p.type), '(absent)'));
    }
  }
  return all;
}

function at(value: unknown, where: string): unknown {
  if (!where) return value;
  let v = value;
  for (const part of where.split('.')) {
    if (v === null || typeof v !== 'object') return undefined;
    v = (v as Record<string, unknown>)[part];
  }
  return v;
}

/** The declarations of the app's types, from the files that hold them. */
function loadTypes(files: string[]): Map<string, ts.Node> {
  const decls = new Map<string, ts.Node>();
  for (const file of files) {
    const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    src.forEachChild((node) => {
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) decls.set(node.name.text, node);
    });
  }
  return decls;
}

/** Check every fixture the manifest names at `folder` against the type it says. */
export function checkFixtures(root = process.cwd(), folder = join(root, 'src/api/__tests__/fixtures/contract')): CheckResult {
  const decls = loadTypes([join(root, 'src/api/types.ts'), join(root, 'src/update/release.ts')]);
  const manifest = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8')) as Fixture[];
  const errors: Mismatch[] = [];
  const extras: Mismatch[] = [];
  for (const entry of manifest) {
    const value = JSON.parse(readFileSync(join(folder, entry.file), 'utf8'));
    const node = decls.get(entry.type.replace(/\[\]$/, ''));
    if (!node) {
      errors.push({ fixture: entry.file, from: entry.from ?? '', path: '', kind: 'missing', expected: entry.type, got: '(no such type)' });
      continue;
    }
    const ctx: Ctx = { decls, fixture: entry.file, from: entry.from ?? '' };
    const isArray = entry.type.endsWith('[]');
    const got = isArray
      ? array(at(value, entry.at ?? ''), node, entry.at ?? '', ctx)
      : walkNode(at(value, entry.at ?? ''), node, entry.at ?? '', ctx);
    errors.push(...got.errors);
    extras.push(...got.extras);
  }
  return { errors, extras, fixtures: manifest.length };
}

/** The checker's table: one line per mismatch. */
export function formatTable(result: CheckResult): string {
  const rows = [...result.errors, ...result.extras];
  const head = ['fixture', 'kind', 'where', 'the type says', 'the answer had'];
  const body = rows.map((m) => [m.fixture, m.kind, m.path || '(root)', m.expected, m.got]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  const out = [line(head), widths.map((w) => '─'.repeat(w)).join('  '), ...body.map(line)];
  out.push(
    '',
    `${result.fixtures} fixtures: ${result.errors.length} mismatch${result.errors.length === 1 ? '' : 'es'}` +
      `, ${result.extras.length} field${result.extras.length === 1 ? '' : 's'} the app does not type`,
  );
  return out.join('\n');
}

const isMain = process.argv[1] && /contract-check\.(ts|mjs|js)$/.test(process.argv[1]);
if (isMain) {
  const result = checkFixtures();
  console.log(formatTable(result));
  process.exitCode = result.errors.length ? 1 : 0;
}
