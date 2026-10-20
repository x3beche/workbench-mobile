/**
 * Each account's session, kept apart from everything else: in the phone's
 * secure storage (Android Keystore, iOS Keychain; expo-secure-store), one
 * entry per account, keyed by the account's own id. Never in AsyncStorage on
 * a phone, never logged. The web build has no such store: secrets.web.ts.
 */
import * as SecureStore from 'expo-secure-store';

const key = (account: string) => `wb.session.${account.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function readSession(account: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key(account));
  } catch {
    return null;
  }
}

export async function writeSession(account: string, session: string): Promise<void> {
  await SecureStore.setItemAsync(key(account), session);
}

export async function dropSession(account: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key(account));
  } catch {
    // Nothing kept for it.
  }
}
