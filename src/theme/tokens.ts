/**
 * The palette: one of the web app's themes, token for token (themes.ts,
 * written from redline-studio's frontend/src/styles.css by
 * scripts/make-themes.mjs), chosen in Settings > Theme - Spartan Dark unless
 * another was chosen, or the phone's own light or dark with "Follow the
 * phone". The names are the CSS custom properties' (without the dashes,
 * camel-cased), so a colour can be traced back to the web app in one search.
 *
 * It is chosen once, when this file is first loaded and before any style is
 * made from it; a new choice is worn after the app starts again (Settings
 * restarts it).
 *
 * Nothing in the app carries a colour literal outside this file and themes.ts.
 */
import { Appearance } from 'react-native';

import { readThemePref } from '../storage/themePref';
import { THEMES, type ThemeDef } from './themes';

export interface Palette {
  surface: string;
  surface2: string;
  hover: string;
  pressed: string;
  line: string;
  /**
   * A line you can see: the same hairline at 3:1 against the ground, for the
   * edge of a control (a field, a button, a box to tick). Decorative
   * dividers stay on `line`.
   */
  lineStrong: string;
  /** Keyboard focus: the accent, made visible on this ground. */
  focus: string;
  ink: string;
  inkDim: string;
  inkBright: string;
  inkOnAccent: string;
  accent: string;
  accentDeep: string;
  warn: string;
  /** A warning banner's ground: the warn colour at 9 %, as the web app mixes it. */
  warnSoft: string;
  danger: string;
  ok: string;
  /** Recording dot: the web app's "pen" red, the colour it uses for live marks. */
  pen: string;
  scrim: string;
  /** Scrollbars: a faint thumb on no track, brighter under the pointer and while dragged (web build). */
  scrollThumb: string;
  scrollHover: string;
  scrollActive: string;
  shadowSoft: string;
  codeKw: string;
  codeStr: string;
  codeNum: string;
  codeCom: string;
  codeFn: string;
  /** The charts' series, in order (the web's --series-1 to -8). */
  series1: string;
  series2: string;
  series3: string;
  series4: string;
  series5: string;
  series6: string;
  series7: string;
  series8: string;
}

/** The theme a phone wears that never chose one. */
export const DEFAULT_THEME = 'spartan-dark';
/** "Follow the phone": these two, by the phone's light or dark. */
export const SYSTEM_THEME = 'system';
const SYSTEM_LIGHT = 'light';
const SYSTEM_DARK = 'spartan-dark';

/** `#rrggbb` (or `#rgb`) at `alpha`, as rgba(); anything else as it is. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** A colour's three channels: `#rrggbb`, `#rgb`, `rgb(...)`; null for anything else. */
function channels(colour: string): [number, number, number] | null {
  const c = colour.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** WCAG relative luminance (0 is black, 1 is white); 0 for a colour that is not one. */
export function luminance(colour: string): number {
  const c = channels(colour);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast between two colours: 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` laid over `bg` at `alpha`, as a hex colour. */
export function mixOn(fg: string, bg: string, alpha: number): string {
  const f = channels(fg);
  const b = channels(bg);
  if (!f || !b) return fg;
  const at = Math.max(0, Math.min(1, alpha));
  return `#${f.map((v, i) => hex2(v * at + b[i] * (1 - at))).join('')}`;
}

/**
 * The colour as it has to be to be seen on `bg`: itself once it reaches 3:1
 * (WCAG's floor for a line or a control's edge), else the same hue moved
 * toward white or black - the light one on a dark ground, the dark one on a
 * light ground - until it does. Never a guess about which theme it is on.
 */
export function readableOn(colour: string, bg: string): string {
  if (!channels(colour) || !channels(bg)) return colour;
  if (contrast(colour, bg) >= 3) return colour;
  const toward = luminance(bg) < 0.4 ? '#ffffff' : '#000000';
  for (let a = 0.1; a <= 0.95; a += 0.05) {
    const mixed = mixOn(toward, colour, a);
    if (contrast(mixed, bg) >= 3) return mixed;
  }
  return toward;
}

/**
 * `bg` moved toward black (or white, if that is the way) until `fg` reads on
 * it at `need`: white on a mid red is 3.8:1, and 12px of it needs 4.5.
 */
export function groundUnder(fg: string, bg: string, need = 4.5): string {
  if (!channels(fg) || !channels(bg)) return bg;
  if (contrast(fg, bg) >= need) return bg;
  for (const toward of ['#000000', '#ffffff']) {
    for (let a = 0.04; a <= 0.8; a += 0.02) {
      const mixed = mixOn(toward, bg, a);
      if (contrast(fg, mixed) >= need) return mixed;
    }
  }
  return bg;
}

/** The theme for a stored choice: the one named, the phone's for "system", the default for anything unknown. */
export function themeFor(choice: string | null, scheme: string | null | undefined): ThemeDef {
  const id = choice === SYSTEM_THEME ? (scheme === 'light' ? SYSTEM_LIGHT : SYSTEM_DARK) : choice || DEFAULT_THEME;
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
}

/** The charts' series, in order: a line under 3:1 on the card is not a line you can see. */
const SERIES_KEYS = [
  'series1',
  'series2',
  'series3',
  'series4',
  'series5',
  'series6',
  'series7',
  'series8',
] as const;

export function paletteOf(t: ThemeDef): Palette {
  const c = t.colors;
  const p = {
    ...(c as unknown as Omit<Palette, 'warnSoft' | 'lineStrong' | 'focus'>),
    warnSoft: withAlpha(c.warn, 0.09),
  } as Palette;
  // Read against the ground they are drawn on, in whatever theme: the light
  // ones' series were pale yellows and greens on white.
  for (const key of SERIES_KEYS) p[key] = readableOn(String(c[key] ?? '#888888'), c.surface);
  p.focus = readableOn(c.accent, c.surface);
  p.lineStrong = readableOn(mixOn(c.ink, c.surface, 0.5), c.surface);
  return p;
}

let scheme: string | null | undefined = null;
try {
  scheme = Appearance.getColorScheme();
} catch {
  scheme = null;
}

/** The choice stored (a theme's id, or "system"); the default when none. */
export const themeChoice: string = readThemePref() || DEFAULT_THEME;
/** The theme worn now. */
export const theme: ThemeDef = themeFor(themeChoice, scheme);
export const colors: Palette = paletteOf(theme);

/**
 * A scroll view's bar: white on a dark ground, black on a light one. Every
 * list said "white", so in the light themes the bar was invisible.
 */
export const indicatorStyle: 'white' | 'black' = theme.light ? 'black' : 'white';

/**
 * Fonts. The web app sets body text in IBM Plex Sans and data in IBM Plex
 * Mono (both SIL Open Font License, bundled through @expo-google-fonts). Its
 * wordmark uses Switzer, which is not redistributable here, so the wordmark
 * falls back to Plex Sans SemiBold - the same fallback the web CSS declares.
 */
export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemi: 'IBMPlexSans_600SemiBold',
  sansItalic: 'IBMPlexSans_400Regular_Italic',
  mono: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
} as const;

/**
 * The type scale: titles 17-20, body 16, meta 12-13. Sizes follow the web
 * app's chat room (styles.css, .tcv-cc-*), scaled for touch.
 */
export const type = {
  body: 16,
  bodyLine: 24,
  /** What is being typed: a little larger, so it reads while it is written. */
  input: 16,
  inputLine: 22,
  small: 13,
  smallLine: 19,
  tiny: 12,
  tinyLine: 17,
  /** The smallest words there are: group heads, a row's second line, a mono time. */
  micro: 11,
  microLine: 15,
  /** A list row's title (the web's .tcv-cc-item). */
  row: 13.5,
  rowLine: 18,
  /** A name or a quiet button: a step under the body, a step over a row. */
  lead: 15,
  leadLine: 21,
  title: 17,
  /** The greeting on a new conversation. */
  display: 20,
  displayLine: 27,
  brand: 24,
} as const;

export const radius = {
  sm: 5,
  md: 6,
  lg: 8,
  bubble: 18,
  field: 22,
  round: 999,
  /** A sheet rising from the bottom: its top corners only. */
  sheet: 16,
  /** A question in the middle of the screen. */
  dialog: 12,
  /** A box to tick, in a list or beside a selection bar. */
  check: 4,
} as const;

/**
 * A page of paper: a PDF's page is white in every theme. The app's brightest
 * ink is not white in a light theme, so a page drawn on it came out black.
 */
export const paper = '#ffffff';

/**
 * The home screen widget's ground: a mid grey plate the two cards sit on (the
 * user, 2026-10-29: grey, not the light one that read as white). It is the one
 * colour in the app that is no theme's - the widget is laid over the
 * wallpaper, and a plate reads as a widget there where a black rectangle reads
 * as a hole. The cards on it stay the theme's, so their words do.
 */
export const widgetGround = '#45464c';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** The side margin of every screen: text and controls never sit closer to the edge. */
export const gutter = space.lg;

/** The smallest thing a finger is asked to hit. */
export const touch = 44;

/**
 * Motion: short, opacity and transform only, and none at all when the
 * system asks for reduced motion (components/Appear.tsx).
 */
export const motion = { enter: 220, sheet: 180, shift: 12, drawer: 240, fade: 160 } as const;

/** The drawer's width on a phone: most of the screen, never more than this. */
export const drawerMax = 320;

/** The drawer's column once it stays open beside the content (a tablet, a desktop browser). */
export const sideWidth = 300;

/** At least this wide (a tablet, a desktop browser), the drawer stays open as a side column. */
export const wideAt = 860;
