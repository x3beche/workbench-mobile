/**
 * Spartan Dark, the Workbench web app's default theme.
 *
 * Every value is copied from `:root[data-theme="spartan-dark"]` in the web
 * app's `frontend/src/styles.css` (redline-studio). Keep the names the same as
 * the CSS custom properties (without the leading dashes, camel-cased) so a
 * colour can be traced back to the web app in one search.
 *
 * Nothing in the app carries a colour literal outside this file.
 */
export const spartanDark = {
  surface: '#09090b',
  surface2: '#18181b',
  hover: '#27272a',
  pressed: '#3f3f46',
  line: '#27272a',

  ink: '#fafafa',
  inkDim: '#a1a1aa',
  inkBright: '#ffffff',
  inkOnAccent: '#18181b',

  accent: '#fafafa',
  accentDeep: '#27272a',
  warn: '#e88c30',
  danger: '#ef4444',
  ok: '#2eb88a',

  /** Recording dot: the web app's "pen" red, the colour it uses for live marks. */
  pen: '#ff2d3f',

  scrim: 'rgba(9, 9, 11, 0.88)',
  shadowSoft: 'rgba(0, 0, 0, 0.55)',

  codeKw: '#c084fc',
  codeStr: '#86efac',
  codeNum: '#fdba74',
  codeCom: '#71717a',
  codeFn: '#93c5fd',
} as const;

export type Palette = typeof spartanDark;

export const colors: Palette = spartanDark;

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
