/**
 * The in-app update, held for as long as the app is signed in to a server:
 * the server is asked for its latest build when the app starts, when it
 * comes back to the front (at most every few hours), when Account is opened
 * and when Check is tapped; a newer one can be downloaded and
 * handed to Android's installer from Account, and the download goes on
 * while Account is closed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { WorkbenchClient } from '../api/client';
import {
  canInstallUpdates,
  clearDownloads,
  downloadApk,
  launchInstaller,
  mayInstall,
  openInstallSetting,
  verifyApk,
} from './apk';
import { installedApp } from './installed';
import {
  apkUrl,
  checkForUpdate,
  downloadFailure,
  dueForCheck,
  RECHECK_MS,
  type Check,
  type Installed,
  UpdateError,
  type UpdateFailure,
} from './release';

/** Where getting the new build is. */
export type Job =
  | { state: 'idle' }
  | { state: 'downloading'; got: number; total: number }
  | { state: 'verifying' }
  /** Android must first allow this app to install apps. */
  | { state: 'permission' }
  | { state: 'installing' }
  /** Downloaded and checked, the installer closed without installing. */
  | { state: 'ready' }
  | { state: 'failed'; failure: UpdateFailure };

export interface Update {
  installed: Installed;
  /** The last answer (kept while the server is asked again). */
  check: Check;
  /** The server is being asked now. */
  checking: boolean;
  job: Job;
  /** This build can download and install (Android with the app's own module), not just tell. */
  canInstall: boolean;
  /** Ask the server now; `fresh` skips it when the last answer is younger than that. */
  recheck: (fresh?: number) => void;
  install: () => Promise<void>;
  cancel: () => void;
  allow: () => Promise<void>;
}

export function useUpdate(client: WorkbenchClient | null, server: string | null): Update {
  const [installed] = useState<Installed>(installedApp);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [checking, setChecking] = useState(false);
  const [job, setJob] = useState<Job>({ state: 'idle' });
  const lastAt = useRef<number | null>(null);
  const asking = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const file = useRef<string | null>(null);
  const busy = job.state === 'downloading' || job.state === 'verifying' || job.state === 'installing';

  const ask = useCallback(async () => {
    if (!client || asking.current) return;
    asking.current = true;
    setChecking(true);
    try {
      const got = await checkForUpdate(client, installed);
      lastAt.current = Date.now();
      setCheck(got);
    } finally {
      asking.current = false;
      setChecking(false);
    }
  }, [client, installed]);

  const recheck = useCallback(
    (fresh = 0) => {
      if (fresh && !dueForCheck(lastAt.current, Date.now(), fresh)) return;
      ask();
    },
    [ask],
  );

  // On start: the last update's APK is no use any more; then the server is asked.
  useEffect(() => {
    if (canInstallUpdates) clearDownloads();
  }, []);

  useEffect(() => {
    lastAt.current = null;
    ask();
  }, [ask, server]);

  // Back to the front: asked again once the last answer is a few hours old.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && dueForCheck(lastAt.current, Date.now(), RECHECK_MS)) ask();
    });
    return () => sub.remove();
  }, [ask]);

  // Signed out or another server: a download on its way stops.
  useEffect(() => () => abort.current?.abort(), [client]);

  const handOver = useCallback(async (uri: string) => {
    if (!mayInstall()) {
      setJob({ state: 'permission' });
      return;
    }
    setJob({ state: 'installing' });
    try {
      await launchInstaller(uri);
      setJob({ state: 'ready' });
    } catch (e) {
      setJob({ state: 'failed', failure: downloadFailure(e) });
    }
  }, []);

  const install = useCallback(async () => {
    if (!canInstallUpdates || !server || check.state !== 'available' || busy) return;
    if (job.state === 'ready' && file.current) {
      handOver(file.current);
      return;
    }
    const release = check.release;
    const ctl = new AbortController();
    abort.current = ctl;
    let shown = -1;
    setJob({ state: 'downloading', got: 0, total: release.size ?? -1 });
    try {
      const uri = await downloadApk(
        apkUrl(server, release),
        release,
        (got, total) => {
          // A redraw for each step of half a percent, not for every block read.
          const all = total > 0 ? total : (release.size ?? 0);
          const step = all > 0 ? Math.floor((got / all) * 200) : Math.floor(got / 500_000);
          if (step === shown) return;
          shown = step;
          setJob({ state: 'downloading', got, total: all || -1 });
        },
        ctl.signal,
      );
      if (ctl.signal.aborted) throw new UpdateError({ kind: 'cancelled' });
      setJob({ state: 'verifying' });
      await verifyApk(uri, release);
      file.current = uri;
      await handOver(uri);
    } catch (e) {
      file.current = null;
      setJob({ state: 'failed', failure: ctl.signal.aborted ? { kind: 'cancelled' } : downloadFailure(e) });
    } finally {
      if (abort.current === ctl) abort.current = null;
    }
  }, [server, check, busy, job.state, handOver]);

  const cancel = useCallback(() => abort.current?.abort(), []);

  /** To the "Install unknown apps" switch; once it is on, straight on to the installer. */
  const allow = useCallback(async () => {
    try {
      await openInstallSetting();
    } catch {
      // No such screen on this phone: the person finds it in Settings.
    }
    if (mayInstall() && file.current) handOver(file.current);
  }, [handOver]);

  return { installed, check, checking, job, canInstall: canInstallUpdates, recheck, install, cancel, allow };
}
