/** A light haptic tick (sending, a new chat, a copy) and copying to the clipboard. Both quietly do nothing where they cannot. */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function tick(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export async function copy(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    tick();
    return true;
  } catch {
    return false;
  }
}
