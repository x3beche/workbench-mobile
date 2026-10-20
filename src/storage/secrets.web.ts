/**
 * The web build's sessions (a review build only): the browser's own storage,
 * one entry per account. A browser has no keystore; the phone builds use
 * secrets.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (account: string) => `wb.session.${account}`;

export async function readSession(account: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(account));
  } catch {
    return null;
  }
}

export async function writeSession(account: string, session: string): Promise<void> {
  await AsyncStorage.setItem(key(account), session);
}

export async function dropSession(account: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(account));
  } catch {
    // Nothing kept for it.
  }
}
