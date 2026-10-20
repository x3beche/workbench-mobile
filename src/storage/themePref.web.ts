/** The web build's theme choice: the browser's localStorage (themePref.ts on a phone). */
const KEY = 'wb.theme';

export function readThemePref(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeThemePref(id: string): void {
  try {
    globalThis.localStorage?.setItem(KEY, id);
  } catch {
    // Not kept.
  }
}
