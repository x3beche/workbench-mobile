/** The web build: nothing is downloaded or installed; Account shows the versions only. */
import type { Release } from './release';

export const canInstallUpdates = false;

export function clearDownloads(): void {}

export async function downloadApk(
  _url: string,
  _release: Release,
  _onProgress: (got: number, total: number) => void,
  _signal: AbortSignal,
): Promise<string> {
  throw new Error('Not in a browser.');
}

export async function verifyApk(_uri: string, _release: Release): Promise<void> {}

export function mayInstall(): boolean {
  return false;
}

export async function openInstallSetting(): Promise<void> {}

export async function launchInstaller(_uri: string): Promise<void> {}
