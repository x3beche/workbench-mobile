import { ApiError, WorkbenchClient } from '../../api/client';
import {
  apkUrl,
  checkForUpdate,
  compareVersions,
  downloadFailure,
  dueForCheck,
  formatSize,
  isNewer,
  notesFor,
  parseRelease,
  RECHECK_MS,
  UpdateError,
  type Release,
} from '../release';
import { uiLang, updateStrings } from '../strings';

// What redline.medipol.dev answered on 2026-10-18.
const SERVER_JSON = {
  version: '1.4.0',
  versionCode: 7,
  size: 39610582,
  sha256: '05711C085D24B5DD4FB56E3AFD35DFE56A9C1C534B1E8423F70E4A6ABFDE6E06',
  built_at: '2026-10-18T11:20:35+00:00',
  published_at: '2026-10-18T11:25:01+00:00',
  min_sdk: 24,
  min_android: '7.0',
  abis: ['arm64-v8a'],
  file: 'workbench-1.4.0.apk',
  url: '/api/public/m/app.apk',
};

const release = (over: Partial<Release> = {}): Release => ({ ...parseRelease(SERVER_JSON)!, ...over });

describe('parseRelease', () => {
  it("reads the server's app.json", () => {
    expect(parseRelease(SERVER_JSON)).toEqual({
      version: '1.4.0',
      versionCode: 7,
      size: 39610582,
      sha256: '05711c085d24b5dd4fb56e3afd35dfe56a9c1c534b1e8423f70e4a6abfde6e06',
      url: '/api/public/m/app.apk',
      notes: null,
      minSdk: 24,
      publishedAt: '2026-10-18T11:25:01+00:00',
    });
  });

  it('is not fooled by something else', () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease([])).toBeNull();
    expect(parseRelease({ versionCode: 3 })).toBeNull();
    const odd = parseRelease({ version: '2.0.0', versionCode: '9', sha256: 'nope', size: -1 })!;
    expect(odd.versionCode).toBe(9);
    expect(odd.sha256).toBeNull();
    expect(odd.size).toBeNull();
    expect(odd.url).toBe('/api/public/m/app.apk');
  });

  it('takes notes as one text, a list, or per language', () => {
    expect(parseRelease({ ...SERVER_JSON, notes: '  Updates in the app.  ' })!.notes).toBe('Updates in the app.');
    expect(parseRelease({ ...SERVER_JSON, changelog: ['One', ' ', 'Two'] })!.notes).toBe('- One\n- Two');
    expect(parseRelease({ ...SERVER_JSON, release_notes: { en: 'New', tr: 'Yeni' } })!.notes).toEqual({
      en: 'New',
      tr: 'Yeni',
    });
  });
});

describe('notesFor', () => {
  it('picks the reader’s language, else the other one', () => {
    expect(notesFor({ en: 'New', tr: 'Yeni' }, 'tr')).toBe('Yeni');
    expect(notesFor({ en: 'New' }, 'tr')).toBe('New');
    expect(notesFor('Same for all', 'en')).toBe('Same for all');
    expect(notesFor(null, 'en')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('compares by number, not by text', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBe(1);
    expect(compareVersions('1.4.0', '1.5.0')).toBe(-1);
    expect(compareVersions('1.5', '1.5.0')).toBe(0);
    expect(compareVersions('v2.0.0', '1.99.99')).toBe(1);
  });

  it('puts a pre-release before its release', () => {
    expect(compareVersions('1.5.0-beta', '1.5.0')).toBe(-1);
    expect(compareVersions('1.5.0', '1.5.0-rc.1')).toBe(1);
  });
});

describe('isNewer', () => {
  it('goes by versionCode when both know it', () => {
    expect(isNewer(release({ versionCode: 8, version: '1.5.0' }), { version: '1.4.0', code: 7 })).toBe(true);
    expect(isNewer(release({ versionCode: 7 }), { version: '1.4.0', code: 7 })).toBe(false);
    // A rebuild with a higher code and the same name is still an update; a lower code never is.
    expect(isNewer(release({ versionCode: 9, version: '1.5.0' }), { version: '1.5.0', code: 8 })).toBe(true);
    expect(isNewer(release({ versionCode: 6, version: '9.0.0' }), { version: '1.5.0', code: 8 })).toBe(false);
  });

  it('falls back to the version when a code is missing', () => {
    expect(isNewer(release({ versionCode: null, version: '1.5.1' }), { version: '1.5.0', code: 8 })).toBe(true);
    expect(isNewer(release({ versionCode: 9, version: '1.5.0' }), { version: '1.5.0', code: null })).toBe(false);
  });
});

describe('apkUrl', () => {
  it('resolves the server’s path on the server', () => {
    expect(apkUrl('https://redline.medipol.dev', release())).toBe('https://redline.medipol.dev/api/public/m/app.apk');
    expect(apkUrl('http://192.168.1.20:8000', release())).toBe('http://192.168.1.20:8000/api/public/m/app.apk');
  });

  it('never follows the APK to another host', () => {
    expect(apkUrl('https://a.example', release({ url: 'https://evil.example/x.apk' }))).toBe(
      'https://a.example/api/public/m/app.apk',
    );
    expect(apkUrl('https://a.example', release({ url: 'https://a.example/builds/1.apk' }))).toBe(
      'https://a.example/builds/1.apk',
    );
  });
});

describe('dueForCheck', () => {
  it('asks the first time, then after the interval', () => {
    const now = 10 * RECHECK_MS;
    expect(dueForCheck(null, now)).toBe(true);
    expect(dueForCheck(now - RECHECK_MS + 1, now)).toBe(false);
    expect(dueForCheck(now - RECHECK_MS, now)).toBe(true);
    expect(dueForCheck(now - 61_000, now, 60_000)).toBe(true);
  });
});

describe('formatSize', () => {
  it('reads like the phone’s own', () => {
    expect(formatSize(39610582)).toBe('39.6\u00a0MB');
    expect(formatSize(39610582, 'tr')).toBe('39,6\u00a0MB');
    expect(formatSize(512_000)).toBe('512\u00a0kB');
    expect(formatSize(900)).toBe('900\u00a0B');
    expect(formatSize(null)).toBe('');
  });
});

describe('downloadFailure', () => {
  it('tells cancelled, refused, full and offline apart', () => {
    const abort = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    expect(downloadFailure(abort)).toEqual({ kind: 'cancelled' });
    expect(downloadFailure(new Error('Unable to download a file: response has status: 429'))).toEqual({
      kind: 'http',
      status: 429,
    });
    expect(downloadFailure(new Error('write failed: ENOSPC (No space left on device)'))).toEqual({ kind: 'storage' });
    expect(downloadFailure(new Error('Unable to resolve host "redline.medipol.dev"'))).toEqual({ kind: 'network' });
    expect(downloadFailure(new UpdateError({ kind: 'hash' }))).toEqual({ kind: 'hash' });
  });
});

describe('checkForUpdate', () => {
  const client = (answer: () => Promise<unknown>) => {
    const c = new WorkbenchClient('https://w.example');
    jest.spyOn(c, 'request').mockImplementation(answer as never);
    return c;
  };

  it('says there is an update when the server’s build is newer', async () => {
    const c = client(async () => ({ ...SERVER_JSON, version: '1.5.0', versionCode: 8 }));
    const got = await checkForUpdate(c, { version: '1.4.0', code: 7 });
    expect(got.state).toBe('available');
    expect(got.state === 'available' && got.release.version).toBe('1.5.0');
    expect(c.request).toHaveBeenCalledWith('GET', '/api/public/m/app.json');
  });

  it('says up to date for the same build or an older one', async () => {
    expect(
      (
        await checkForUpdate(
          client(async () => SERVER_JSON),
          { version: '1.4.0', code: 7 },
        )
      ).state,
    ).toBe('current');
    expect(
      (
        await checkForUpdate(
          client(async () => SERVER_JSON),
          { version: '1.5.0', code: 8 },
        )
      ).state,
    ).toBe('current');
  });

  it('a server without a build, or without the route, has nothing to offer', async () => {
    const none = client(async () => {
      throw new ApiError(404, 'no Android build is published on this server');
    });
    expect(await checkForUpdate(none, { version: '1.5.0', code: 8 })).toEqual({ state: 'none' });
  });

  it('a server out of reach is an error that says so', async () => {
    const off = client(async () => {
      throw new ApiError(0, 'The server could not be reached.');
    });
    expect(await checkForUpdate(off, { version: '1.5.0', code: 8 })).toEqual({
      state: 'error',
      offline: true,
      message: 'The server could not be reached.',
    });
    const odd = client(async () => '<html>');
    expect((await checkForUpdate(odd, { version: '1.5.0', code: 8 })).state).toBe('error');
  });
});

describe('strings', () => {
  it('follows the voice language, and the phone with Auto', () => {
    expect(uiLang('tr', 'en-US')).toBe('tr');
    expect(uiLang('en', 'tr-TR')).toBe('en');
    expect(uiLang('auto', 'tr-TR')).toBe('tr');
    expect(uiLang('auto', 'de-DE')).toBe('en');
    expect(uiLang('auto', undefined)).toBe('en');
  });

  it('says the versions plainly, in both languages', () => {
    expect(updateStrings('en').version('1.5.0')).toBe('Version 1.5.0');
    expect(updateStrings('tr').version('1.5.0')).toBe('Sürüm 1.5.0');
    expect(updateStrings('en').ready('1.5.1')).toBe('Version 1.5.1 is ready');
    expect(updateStrings('tr').ready('1.5.1')).toBe('Sürüm 1.5.1 hazır');
    expect(updateStrings('en').drawer('1.5.1')).toBe('Update ready: 1.5.1');
    expect(updateStrings('tr').drawer('1.5.1')).toBe('Güncelleme hazır: 1.5.1');
  });

  it('has no dashes or arrows in anything it says', () => {
    for (const lang of ['en', 'tr'] as const) {
      const t = updateStrings(lang);
      const said = [
        ...Object.values(t).filter((v): v is string => typeof v === 'string'),
        ...Object.values(t.errors),
        t.version('1'),
        t.ready('1'),
        t.youHave('1'),
        t.checkFailed('x'),
        t.downloading('1', '2'),
        t.downloadingNoTotal('1'),
        t.drawer('1'),
        t.http(500),
      ];
      for (const line of said) expect(line).not.toMatch(/[\u2013\u2014\u2192]|->/);
    }
  });
});
