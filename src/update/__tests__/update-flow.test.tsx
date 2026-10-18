import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { WorkbenchClient } from '../../api/client';
import { UpdateSection } from '../../components/UpdateSection';
import * as apk from '../apk';
import { UpdateError } from '../release';
import { updateStrings } from '../strings';
import { useUpdate } from '../useUpdate';

jest.mock('../apk', () => ({
  canInstallUpdates: true,
  clearDownloads: jest.fn(),
  downloadApk: jest.fn(),
  verifyApk: jest.fn(async () => undefined),
  mayInstall: jest.fn(() => true),
  openInstallSetting: jest.fn(async () => undefined),
  launchInstaller: jest.fn(async () => undefined),
}));
jest.mock('../installed', () => ({ installedApp: () => ({ version: '1.4.0', code: 7 }) }));

const mocked = apk as jest.Mocked<typeof apk>;

const NEWER = {
  version: '1.5.0',
  versionCode: 8,
  size: 40_000_000,
  sha256: 'a'.repeat(64),
  url: '/api/public/m/app.apk',
};

function client(answer: unknown) {
  const c = new WorkbenchClient('https://w.example');
  jest.spyOn(c, 'request').mockImplementation((async () => answer) as never);
  return c;
}

function Harness({ c, lang = 'en' }: { c: WorkbenchClient; lang?: 'en' | 'tr' }) {
  const update = useUpdate(c, 'https://w.example');
  return <UpdateSection update={update} t={updateStrings(lang)} lang={lang} />;
}

/** A download that is fed by hand. */
function heldDownload() {
  let progress: (got: number, total: number) => void = () => undefined;
  let finish: (uri: string) => void = () => undefined;
  let fail: (e: unknown) => void = () => undefined;
  mocked.downloadApk.mockImplementation((_url, _r, onProgress, signal) => {
    progress = onProgress;
    return new Promise((res, rej) => {
      finish = res;
      fail = rej;
      signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  });
  return {
    progress: (got: number, total: number) => progress(got, total),
    finish: (uri: string) => finish(uri),
    fail: (e: unknown) => fail(e),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.mayInstall.mockReturnValue(true);
});

it('says the app is up to date, with the installed version', async () => {
  await render(<Harness c={client({ ...NEWER, version: '1.4.0', versionCode: 7 })} />);
  expect(await screen.findByText('Installed 1.4.0 — up to date')).toBeTruthy();
  expect(screen.getByTestId('update-check')).toBeTruthy();
  expect(screen.queryByTestId('update-install')).toBeNull();
  expect(mocked.clearDownloads).toHaveBeenCalled();
});

it('shows both versions and the size, in Turkish too', async () => {
  await render(
    <Harness
      c={client({ ...NEWER, notes: { en: 'Updates in the app.', tr: 'Uygulama içinden güncelleme.' } })}
      lang="tr"
    />,
  );
  expect(await screen.findByText('Güncelleme var')).toBeTruthy();
  expect(screen.getByTestId('update-status')).toHaveTextContent('Yüklü 1.4.0 → Yeni 1.5.0 · 40,0\u00a0MB');
  expect(screen.getByTestId('update-notes')).toHaveTextContent('Uygulama içinden güncelleme.');
  expect(screen.getByText('İndir ve yükle')).toBeTruthy();
});

it('downloads with progress, checks it, then opens the installer', async () => {
  const dl = heldDownload();
  await render(<Harness c={client(NEWER)} />);
  await fireEvent.press(await screen.findByTestId('update-install'));
  expect(mocked.downloadApk.mock.calls[0][0]).toBe('https://w.example/api/public/m/app.apk');
  await act(async () => dl.progress(10_000_000, 40_000_000));
  expect(screen.getByTestId('update-progress')).toHaveTextContent('Downloading 10.0\u00a0MB of 40.0\u00a0MB (25%)');
  await act(async () => dl.finish('file:///cache/updates/workbench-1.5.0.apk'));
  expect(mocked.verifyApk).toHaveBeenCalledWith(
    'file:///cache/updates/workbench-1.5.0.apk',
    expect.objectContaining({ sha256: 'a'.repeat(64), size: 40_000_000 }),
  );
  expect(mocked.launchInstaller).toHaveBeenCalledWith('file:///cache/updates/workbench-1.5.0.apk');
  // Back from the installer without installing: it can be opened again without a new download.
  expect(screen.getByText('The update was not installed.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Install'));
  await act(async () => undefined);
  expect(mocked.launchInstaller).toHaveBeenCalledTimes(2);
  expect(mocked.downloadApk).toHaveBeenCalledTimes(1);
});

it('asks for "Install unknown apps" first when Android does not allow it yet', async () => {
  const dl = heldDownload();
  mocked.mayInstall.mockReturnValue(false);
  await render(<Harness c={client(NEWER)} />);
  await fireEvent.press(await screen.findByTestId('update-install'));
  await act(async () => dl.finish('file:///cache/updates/workbench-1.5.0.apk'));
  expect(mocked.launchInstaller).not.toHaveBeenCalled();
  expect(screen.getByText(/has to allow Workbench to install apps/)).toBeTruthy();
  mocked.openInstallSetting.mockImplementation(async () => {
    mocked.mayInstall.mockReturnValue(true);
  });
  await fireEvent.press(screen.getByTestId('update-allow'));
  expect(mocked.openInstallSetting).toHaveBeenCalled();
  expect(mocked.launchInstaller).toHaveBeenCalledWith('file:///cache/updates/workbench-1.5.0.apk');
});

it('says why it stopped: a wrong checksum, no network, cancelled', async () => {
  const dl = heldDownload();
  mocked.verifyApk.mockRejectedValueOnce(new UpdateError({ kind: 'hash' }));
  await render(<Harness c={client(NEWER)} />);
  await fireEvent.press(await screen.findByTestId('update-install'));
  await act(async () => dl.finish('file:///x.apk'));
  expect(screen.getByText(/does not match the server’s checksum/)).toBeTruthy();
  expect(mocked.launchInstaller).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText('Try again'));
  await act(async () => dl.fail(new Error('Unable to resolve host "w.example"')));
  expect(screen.getByText(/the server could not be reached/)).toBeTruthy();

  await fireEvent.press(screen.getByText('Try again'));
  await fireEvent.press(screen.getByTestId('update-cancel'));
  expect(screen.getByText('Download cancelled.')).toBeTruthy();
});
