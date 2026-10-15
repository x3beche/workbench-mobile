/**
 * Handing a file to the phone: written to the app's cache, then offered in
 * the system's share sheet (open it in another app, send it, save it to
 * Files or Drive), or kept in a folder the person picks (Android). The web
 * build has its own (share.web.ts): a download.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { blobToDataUri } from '../api/client';

/** A name the file system takes: no slashes or control characters. */
export function safeName(name: string): string {
  return name.replace(/[/\\\u0000-\u001f:*?"<>|]+/g, '-').trim() || 'file';
}

function cacheFile(name: string): File {
  const dir = new Directory(Paths.cache, 'share');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, safeName(name));
  if (file.exists) file.delete();
  return file;
}

async function write(content: Blob | string, name: string): Promise<File> {
  const file = cacheFile(name);
  file.create();
  if (typeof content === 'string') file.write(content);
  else file.write((await blobToDataUri(content)).split(',')[1] ?? '', { encoding: 'base64' });
  return file;
}

async function offer(uri: string, type: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('This phone cannot share files.');
  await Sharing.shareAsync(uri, { mimeType: type, dialogTitle: title });
}

/** The share sheet for some bytes or text, as a file called `name`. */
export async function shareFile(content: Blob | string, name: string, type: string): Promise<void> {
  const file = await write(content, name);
  await offer(file.uri, type, name);
}

/** An HTML page printed to a PDF on the phone, then shared. */
export async function sharePdf(html: string, name: string): Promise<void> {
  const made = await Print.printToFileAsync({ html });
  const file = cacheFile(name);
  await new File(made.uri).move(file, { overwrite: true });
  await offer(file.uri, 'application/pdf', name);
}

/** Can the file be kept in a folder the person picks (Android's folder picker)? Elsewhere the share sheet does it. */
export const canSave = Platform.OS === 'android';

/** Keep the file in a folder picked on the phone. */
export async function saveFile(content: Blob, name: string, type: string): Promise<string> {
  const dir = await Directory.pickDirectoryAsync();
  const file = dir.createFile(safeName(name), type);
  file.write((await blobToDataUri(content)).split(',')[1] ?? '', { encoding: 'base64' });
  return dir.name || 'the folder';
}
