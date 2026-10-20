/**
 * Writes src/theme/themes.ts: every theme of the web app, token for token,
 * from redline-studio's frontend/src/styles.css (the `:root` block is
 * "Workbench dark", each `:root[data-theme="..."]` block a theme; a token a
 * theme leaves out is the default block's). Names and which are light come
 * from frontend/src/theme.ts. Run after the web app's themes change:
 *   node scripts/make-themes.mjs ../redline-studio/frontend/src
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2] || '../redline-studio/frontend/src';
const css = readFileSync(join(src, 'styles.css'), 'utf8');
const ts = readFileSync(join(src, 'theme.ts'), 'utf8');

const TOKENS = {
  surface: 'surface', 'surface-2': 'surface2', hover: 'hover', pressed: 'pressed', line: 'line',
  ink: 'ink', 'ink-dim': 'inkDim', 'ink-bright': 'inkBright', 'ink-on-accent': 'inkOnAccent',
  accent: 'accent', 'accent-deep': 'accentDeep', warn: 'warn', danger: 'danger', ok: 'ok', pen: 'pen',
  scrim: 'scrim', 'scroll-thumb': 'scrollThumb', 'scroll-hover': 'scrollHover', 'scroll-active': 'scrollActive',
  'shadow-soft': 'shadowSoft', 'code-kw': 'codeKw', 'code-str': 'codeStr', 'code-num': 'codeNum',
  'code-com': 'codeCom', 'code-fn': 'codeFn',
  'series-1': 'series1', 'series-2': 'series2', 'series-3': 'series3', 'series-4': 'series4',
  'series-5': 'series5', 'series-6': 'series6', 'series-7': 'series7', 'series-8': 'series8',
};

function block(sel) {
  const at = css.indexOf(sel + ' {');
  if (at < 0) return null;
  const body = css.slice(at + sel.length + 2, css.indexOf('\n}', at));
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) if (m[1] in TOKENS) out[TOKENS[m[1]]] = m[2].trim();
  return out;
}

const ids = JSON.parse(ts.match(/THEMES = (\[[^\]]+\])/s)[1].replace(/'/g, '"').replace(/\s+/g, ' '));
const light = new Set(JSON.parse(ts.match(/LIGHT_THEMES[^=]*= new Set\((\[[^\]]+\])\)/s)[1].replace(/'/g, '"')));
const namesSrc = ts.match(/THEME_NAMES: Record<Theme, string> = \{([^}]+)\}/s)[1];
const names = {};
for (const m of namesSrc.matchAll(/'?([a-z0-9-]+)'?:\s*(['"])(.*?)\2/g)) names[m[1]] = m[3];

const base = block(':root');
const out = [];
for (const id of ids) {
  const own = id === 'default' ? base : block(`:root[data-theme="${id}"]`);
  if (!own) continue;
  const p = { ...base, ...own };
  const missing = Object.values(TOKENS).filter((k) => !p[k]);
  if (missing.length) {
    console.error(`${id}: missing ${missing.join(', ')}`);
    continue;
  }
  out.push({ id, name: names[id] || id, light: light.has(id), colors: p });
}

const text = `/**
 * Every theme of the web app, token for token: written by
 * scripts/make-themes.mjs from redline-studio's frontend/src/styles.css and
 * theme.ts. Do not edit by hand - run the script again.
 */
export interface ThemeDef {
  id: string;
  name: string;
  light: boolean;
  colors: Record<string, string>;
}

export const THEMES: ThemeDef[] = ${JSON.stringify(out, null, 2)};
`;
writeFileSync(new URL('../src/theme/themes.ts', import.meta.url), text);
console.log(`${out.length} themes`);
