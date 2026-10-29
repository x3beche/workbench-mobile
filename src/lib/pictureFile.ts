/**
 * A picked picture's file on the phone, read before it is sent: its size and
 * first bytes (lib/wbc pickedOf). None on the web, where the picker's File
 * is sent as it is, nor where the file cannot be opened.
 */
import { File, FileMode } from 'expo-file-system';
import { Platform } from 'react-native';
import type { PictureHead } from './wbc';

export function readPictureHead(uri: string): PictureHead | null {
  if (Platform.OS === 'web' || !uri) return null;
  try {
    const f = new File(uri);
    const h = f.open(FileMode.ReadOnly);
    try {
      const size = typeof h.size === 'number' ? h.size : typeof f.size === 'number' ? f.size : null;
      return { size, head: h.readBytes(16) };
    } finally {
      h.close();
    }
  } catch {
    return null;
  }
}
