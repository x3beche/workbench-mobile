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

/** Sizes follow the web app's chat room (styles.css, .tcv-cc-*), scaled for touch. */
export const type = {
  body: 15,
  bodyLine: 23,
  small: 13,
  tiny: 12,
  title: 17,
  brand: 24,
} as const;

export const radius = { sm: 5, md: 6, lg: 8, bubble: 10 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Every animation in the app is at most this long (and none at all with reduced motion). */
export const MOTION_MS = 160;
