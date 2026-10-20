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

/** The theme for a stored choice: the one named, the phone's for "system", the default for anything unknown. */
export function themeFor(choice: string | null, scheme: string | null | undefined): ThemeDef {
  const id = choice === SYSTEM_THEME ? (scheme === 'light' ? SYSTEM_LIGHT : SYSTEM_DARK) : choice || DEFAULT_THEME;
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
}

export function paletteOf(t: ThemeDef): Palette {
  const c = t.colors;
  return { ...(c as unknown as Omit<Palette, 'warnSoft'>), warnSoft: withAlpha(c.warn, 0.09) };
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
  tiny: 12,
  title: 17,
  /** The greeting on a new conversation. */
  display: 20,
  brand: 24,
} as const;

export const radius = { sm: 5, md: 6, lg: 8, bubble: 18, field: 22, round: 999 } as const;

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

/** At least this wide (a tablet, a desktop browser), the drawer stays open as a side column. */
export const wideAt = 860;
