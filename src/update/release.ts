/**
 * The in-app update, its pure parts: what the server says its latest
 * Android build is (GET /api/public/m/app.json, backend/mobile_app.py),
 * whether it is newer than the app on the phone, and when to ask again.
 */
import { ApiError, type WorkbenchClient } from '../api/client';

/** The server's description of its latest build. */
export interface Release {
  version: string;
  /** Android's versionCode: what decides "newer" when both sides know it. */
  versionCode: number | null;
  /** Bytes of the APK, to check the download against. */
  size: number | null;
  /** SHA-256 of the APK, lower-case hex. */
  sha256: string | null;
  /** Where the APK is, as the server says it (a path on the server). */
  url: string;
  /** What changed, when the server says (not yet: see SERVER-CHANGES.md, 9). */
  notes: Notes | null;
  minSdk: number | null;
  publishedAt: string | null;
}

/** Release notes: one text, or one per language. */
export type Notes = string | Partial<Record<'en' | 'tr', string>>;

/** The app on this phone. */
export interface Installed {
  version: string;
  code: number | null;
}

export const APP_JSON = '/api/public/m/app.json';
export const APP_APK = '/api/public/m/app.apk';

/** Asked again when the app comes back to the front, at most this often. */
export const RECHECK_MS = 4 * 60 * 60 * 1000;
/** Opening Account asks again unless the last answer is this fresh. */
export const SETTINGS_RECHECK_MS = 60 * 1000;

const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0
    ? v
    : typeof v === 'string' && /^\d+$/.test(v.trim())
      ? Number(v.trim())
      : null;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function notesOf(raw: Record<string, unknown>): Notes | null {
  for (const key of ['notes', 'changelog', 'release_notes']) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v)) {
      const lines = v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => `- ${x.trim()}`);
      if (lines.length) return lines.join('\n');
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const out: Partial<Record<'en' | 'tr', string>> = {};
      if (text(o.en)) out.en = text(o.en)!;
      if (text(o.tr)) out.tr = text(o.tr)!;
      if (out.en || out.tr) return out;
    }
  }
  return null;
}

/** app.json as the app reads it; null when it is not a description of a build. */
export function parseRelease(raw: unknown): Release | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const version = text(r.version);
  if (!version) return null;
  const sha = text(r.sha256)?.toLowerCase() ?? null;
  return {
    version,
    versionCode: int(r.versionCode ?? r.version_code),
    size: int(r.size),
    sha256: sha && /^[0-9a-f]{64}$/.test(sha) ? sha : null,
    url: text(r.url) ?? APP_APK,
    notes: notesOf(r),
    minSdk: int(r.min_sdk),
    publishedAt: text(r.published_at),
  };
}

/** Dotted versions by number: "1.10.0" is after "1.9.2"; a suffix ("-beta") sorts before the plain one. */
export function compareVersions(a: string, b: string): number {
  const split = (v: string) => {
    const [main, ...rest] = v.trim().replace(/^v/i, '').split(/[-+]/);
    return { nums: main.split('.').map((n) => Number.parseInt(n, 10) || 0), pre: rest.length > 0 };
  };
  const x = split(a);
  const y = split(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  if (x.pre !== y.pre) return x.pre ? -1 : 1;
  return 0;
}

/** Is the server's build newer than the app here? By versionCode when both know it, else by the version. */
export function isNewer(release: Release, installed: Installed): boolean {
  if (release.versionCode != null && installed.code != null) return release.versionCode > installed.code;
  return compareVersions(release.version, installed.version) > 0;
}

/**
 * The APK's address. The server names it by a path on itself; an address
 * on another host is not followed (the checksum comes from this server, so
 * the file must too).
 */
export function apkUrl(server: string, release: Release): string {
  try {
    const got = new URL(release.url, `${server}/`);
    const base = new URL(server);
    if (got.origin === base.origin && /^https?:$/.test(got.protocol)) return got.toString();
  } catch {
    // Not an address: the route every server has.
  }
  return `${server}${APP_APK}`;
}

/** Time to ask again? */
export function dueForCheck(lastAt: number | null, now: number, every = RECHECK_MS): boolean {
  return lastAt == null || now - lastAt >= every;
}

/** The notes in the reader's language, else whichever there is. */
export function notesFor(notes: Notes | null, lang: 'en' | 'tr'): string | null {
  if (!notes) return null;
  if (typeof notes === 'string') return notes;
  return notes[lang] ?? notes.en ?? notes.tr ?? null;
}

/** "37.8 MB", "512 kB" - decimal units, as Android's own Files app counts them. */
export function formatSize(bytes: number | null | undefined, lang: 'en' | 'tr' = 'en'): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  const [n, unit] =
    bytes >= 1e9
      ? [bytes / 1e9, 'GB']
      : bytes >= 1e6
        ? [bytes / 1e6, 'MB']
        : bytes >= 1e3
          ? [bytes / 1e3, 'kB']
          : [bytes, 'B'];
  const shown = unit === 'B' || n >= 100 ? String(Math.round(n)) : n.toFixed(1);
  // A no-break space: the number and its unit stay on one line.
  return `${lang === 'tr' ? shown.replace('.', ',') : shown}\u00a0${unit}`;
}

/** What asking the server gave. */
export type Check =
  | { state: 'idle' }
  | { state: 'current'; release: Release | null }
  | { state: 'available'; release: Release }
  /** The server has no build to offer (404), or is too old to have the route. */
  | { state: 'none' }
  | { state: 'error'; offline: boolean; message: string };

/** Ask the server for its latest build and compare it with the app here. */
export async function checkForUpdate(client: WorkbenchClient, installed: Installed): Promise<Check> {
  let raw: unknown;
  try {
    raw = await client.request<unknown>('GET', APP_JSON);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return { state: 'none' };
    return {
      state: 'error',
      offline: e instanceof ApiError && e.status === 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }
  const release = parseRelease(raw);
  if (!release)
    return {
      state: 'error',
      offline: false,
      message: 'The server described its app build in a way this app does not read.',
    };
  return isNewer(release, installed) ? { state: 'available', release } : { state: 'current', release };
}

/** Why an update did not get as far as the installer. */
export type UpdateFailure =
  { kind: 'network' | 'cancelled' | 'size' | 'hash' | 'storage' | 'install' } | { kind: 'http'; status: number };

export class UpdateError extends Error {
  constructor(readonly failure: UpdateFailure) {
    super(failure.kind);
    this.name = 'UpdateError';
  }
}

/** A failed download as the person should hear of it. */
export function downloadFailure(e: unknown): UpdateFailure {
  if (e instanceof UpdateError) return e.failure;
  const name = e instanceof Error ? e.name : '';
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (name === 'AbortError' || /cancel/i.test(msg)) return { kind: 'cancelled' };
  const status = /status:?\s*(\d{3})/i.exec(msg);
  if (status) return { kind: 'http', status: Number(status[1]) };
  if (/ENOSPC|no space|not enough space|disk full/i.test(msg)) return { kind: 'storage' };
  return { kind: 'network' };
}
