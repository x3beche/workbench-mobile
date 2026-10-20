/**
 * Which theme the app wears, read before anything is drawn (theme/tokens.ts
 * builds its palette when it is first loaded, so this has to be synchronous):
 * kept with expo-secure-store's synchronous read. Not a secret - just the
 * one store a phone can read without waiting. secrets.web.ts's sibling,
 * themePref.web.ts, uses localStorage.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'wb.theme';

export function readThemePref(): string | null {
  try {
    return SecureStore.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeThemePref(id: string): void {
  try {
    SecureStore.setItem(KEY, id);
  } catch {
    // Not kept: the theme is the default next time.
  }
}
