/**
 * Getting a new build onto the phone (Android): the APK downloaded into the
 * cache with its progress, checked against the size and SHA-256 the server
 * gave, then handed to Android's package installer through a content://
 * address. Android asks the person to confirm; nothing is installed
 * silently. An APK left from before is deleted.
 *
 * The web build has its own (apk.web.ts): nothing to install there.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { installer } from '../../modules/workbench-installer';
import { UpdateError, type Release } from './release';

const PACKAGE = 'dev.workbench.mobile';
const APK_TYPE = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 0x1;

/** This build can download and install an update: Android, with the app's own native module. */
export const canInstallUpdates = Platform.OS === 'android' && installer != null;

function folder(): Directory {
  return new Directory(Paths.cache, 'updates');
}

/** Every downloaded APK but `keep` is deleted. */
export function clearDownloads(keep?: string): void {
  try {
    const dir = folder();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name !== keep) entry.delete();
    }
  } catch {
    // The cache is the system's to clear as well.
  }
}

/**
 * The release's APK on the phone, downloaded unless the same one is there
 * already. `onProgress` gets the bytes so far and the total (-1: unknown).
 */
export async function downloadApk(
  url: string,
  release: Release,
  onProgress: (got: number, total: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const name = `workbench-${release.version.replace(/[^0-9A-Za-z.+-]/g, '_')}.apk`;
  clearDownloads(name);
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, name);
  if (file.exists && release.size != null && file.size === release.size) return file.uri;
  if (file.exists) file.delete();
  try {
    const got = await File.downloadFileAsync(url, file, {
      idempotent: true,
      signal,
      onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes),
    });
    return got.uri;
  } catch (e) {
    // A download that stopped part way leaves half a file on Android.
    try {
      if (file.exists) file.delete();
    } catch {
      /* gone already */
    }
    throw e;
  }
}

/** The file is what the server described: its size, then its SHA-256. A file that is not is deleted. */
export async function verifyApk(uri: string, release: Release): Promise<void> {
  const file = new File(uri);
  const drop = (kind: 'size' | 'hash') => {
    try {
      file.delete();
    } catch {
      /* gone already */
    }
    throw new UpdateError({ kind });
  };
  if (!file.exists) throw new UpdateError({ kind: 'size' });
  if (release.size != null && file.size !== release.size) drop('size');
  if (release.sha256 && installer) {
    const sum = (await installer.sha256(file.uri)).toLowerCase();
    if (sum !== release.sha256) drop('hash');
  }
}

/** May this app hand an APK to the installer ("Install unknown apps")? */
export function mayInstall(): boolean {
  try {
    return installer?.canInstall() ?? false;
  } catch {
    return false;
  }
}

/** Android's "Install unknown apps" switch for this app; the promise ends when the person comes back. */
export async function openInstallSetting(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, {
      data: `package:${PACKAGE}`,
    });
  } catch {
    // An older Android has the one switch for every app.
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SECURITY_SETTINGS);
  }
}

/**
 * The package installer, for the downloaded APK. The promise ends when the
 * person comes back without installing (an installed update replaces the
 * running app, so it does not come back here).
 */
export async function launchInstaller(uri: string): Promise<void> {
  let content: string;
  try {
    content = await getContentUriAsync(uri);
  } catch {
    throw new UpdateError({ kind: 'install' });
  }
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: content,
      type: APK_TYPE,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  } catch {
    throw new UpdateError({ kind: 'install' });
  }
}
