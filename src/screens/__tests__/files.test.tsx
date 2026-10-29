import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { createRef } from 'react';

import type { WorkbenchClient } from '../../api/client';
import type { FileFolder, StoredFile, TrashFile } from '../../api/types';
import { forgetThumbs } from '../../components/FileThumb';
import * as share from '../../lib/share';
import { FilesScreen, type FilesHandle } from '../FilesScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('../../lib/share', () => ({
  shareFile: jest.fn(async () => undefined),
  sharePdf: jest.fn(async () => undefined),
  saveFile: jest.fn(async () => 'Downloads'),
  canSave: false,
}));

const file = (id: string, name: string, folder = '', extra: Partial<StoredFile> = {}): StoredFile => ({
  id,
  name,
  folder,
  bytes: 2048,
  kind: 'other',
  preview: 'none',
  created_at: new Date(Date.now() - 3600_000).toISOString(),
  by: { id: 'u1', name: 'Ada' },
  ...extra,
});
const folder = (id: string, name: string, parent = '', extra: Partial<FileFolder> = {}): FileFolder => ({
  id,
  name,
  parent,
  ...extra,
});

let files: StoredFile[];
let folders: FileFolder[];
let trash: TrashFile[];

const client = {
  listFiles: jest.fn(async () => files),
  folders: jest.fn(async () => folders),
  virtualTree: jest.fn(async () => ({
    folders: [
      folder('v:projects', 'Projects', '', { root: true, ro: true }),
      folder('v:pf:a', 'Sensor board', 'v:projects', { ro: true }),
    ],
    files: [file('v:ms:1', 'board.step', 'v:pf:a', { ro: true, kind: 'step', preview: 'step' })],
    links: [],
  })),
  // An older server by default: `?under=` ignored, the whole tree; no sized pictures.
  virtualFolder: jest.fn(async () => ({ tree: await client.virtualTree() })),
  previewUri: jest.fn(async () => null),
  filesTrash: jest.fn(async () => ({ days: 30, files: trash })),
  mini: jest.fn(async (id: string) =>
    id === 'f2' ? { state: 'ready', uri: 'data:image/webp;base64,AAAA' } : { state: 'none' },
  ),
  upload: jest.fn(async () => [file('f9', 'scan.pdf')]),
  renameFile: jest.fn(async (id: string, name: string) => {
    files = files.map((f) => (f.id === id ? { ...f, name } : f));
    return files.find((f) => f.id === id);
  }),
  moveFiles: jest.fn(async () => ({ files: 1, folders: 0 })),
  deleteFile: jest.fn(async (id: string) => {
    const f = files.find((x) => x.id === id)!;
    files = files.filter((x) => x.id !== id);
    trash = [...trash, { ...f, deleted_at: '', purge_at: '', folder_path: 'My files', days_left: 30 }];
    return { deleted: id };
  }),
  restoreFiles: jest.fn(async (ids: string[]) => {
    const back = trash.filter((t) => ids.includes(t.id));
    trash = trash.filter((t) => !ids.includes(t.id));
    files = [...files, ...back];
    return { restored: back, refused: [] };
  }),
  purgeFiles: jest.fn(async () => ({ purged: [] })),
  copyToMine: jest.fn(async () => file('f10', 'board (1).step')),
  makeFolder: jest.fn(async () => folder('d9', 'New')),
  renameFolder: jest.fn(),
  deleteFolder: jest.fn(),
  fileBlob: jest.fn(async () => new Blob(['x'])),
  fileUrl: jest.fn((id: string) => `https://wb/api/files/${id}?inline=1`),
  pdfPages: jest.fn(async () => 3),
  pdfPageUrl: jest.fn((id: string, n: number) => `https://wb/api/files/${id}/pdf/page/${n}.png`),
  // The account's session goes with an image (none here: a cookie or local-mode account).
  imageSource: jest.fn((uri: string) => ({ uri })),
  fileText: jest.fn(async () => ({ text: '# Notes\n\nhello', cut: false })),
  table: jest.fn(),
} as unknown as WorkbenchClient & Record<string, jest.Mock>;

const ALL = ['view', 'draw', 'delete'];

async function show(can: string[] = ALL) {
  const ref = createRef<FilesHandle>();
  await render(<FilesScreen ref={ref} client={client} user={{ id: 'u1', name: 'Ada' }} can={can} onMenu={jest.fn()} />);
  await act(async () => undefined);
  return ref;
}

beforeEach(() => {
  jest.clearAllMocks();
  forgetThumbs();
  files = [
    file('f1', 'notes.md', '', { preview: 'markdown', kind: 'text' }),
    file('f2', 'scope.png', 'd1', { preview: 'image', kind: 'image' }),
    file('f3', 'datasheet.pdf', 'd1', { preview: 'pdf', kind: 'pdf' }),
    file('c1', 'from-chat.jpg', 'x', { where: 'chat', ro: true }),
  ];
  folders = [folder('d1', 'Datasheets'), folder('d2', 'Rev C', 'd1')];
  trash = [{ ...file('t1', 'old.zip'), deleted_at: '', purge_at: '', folder_path: 'Datasheets', days_left: 12 }];
});

describe('Files', () => {
  it('lists My files: folders first, own files only, with sizes', async () => {
    await show();
    const list = within(screen.getByTestId('files-list'));
    expect(list.getByText('Datasheets')).toBeTruthy();
    expect(list.getByText('1 folder, 2 files')).toBeTruthy();
    expect(list.getByText('notes.md')).toBeTruthy();
    expect(list.queryByText('from-chat.jpg')).toBeNull();
    expect(list.getByText(/^2\.0 kB · /)).toBeTruthy();
  });

  it('opens a folder with the way back above, shows the server’s thumbnails, and Back goes up', async () => {
    const ref = await show();
    await fireEvent.press(screen.getByTestId('file-row-d:d1'));
    expect(screen.getByTestId('files-crumbs')).toBeTruthy();
    expect(screen.getByText('scope.png')).toBeTruthy();
    expect(await screen.findByTestId('thumb-f2')).toBeTruthy();
    expect(client.mini).toHaveBeenCalledWith('f2');
    await fireEvent.press(screen.getByTestId('file-row-d:d2'));
    expect(screen.getByText('This folder is empty.')).toBeTruthy();
    // Back: up a folder, then up again, then nowhere left here.
    let went: boolean | undefined;
    await act(async () => {
      went = ref.current!.back();
    });
    expect(went).toBe(true);
    expect(screen.getByText('scope.png')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('crumb-top'));
    expect(screen.getByText('notes.md')).toBeTruthy();
    await act(async () => {
      went = ref.current!.back();
    });
    expect(went).toBe(false);
  });

  it('asks for a picture again while the server is still making it', async () => {
    jest.useFakeTimers();
    try {
      let asked = 0;
      (client.mini as jest.Mock).mockImplementation(async (id: string) =>
        id !== 'f2'
          ? { state: 'none' }
          : ++asked === 1
            ? { state: 'later', seconds: 2 }
            : { state: 'ready', uri: 'data:image/webp;base64,BBBB' },
      );
      await show();
      await fireEvent.press(screen.getByTestId('file-row-d:d1'));
      expect(screen.queryByTestId('thumb-f2')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(2100);
      });
      expect(screen.getByTestId('thumb-f2')).toBeTruthy();
      expect(asked).toBe(2);
    } finally {
      (client.mini as jest.Mock).mockImplementation(async (id: string) =>
        id === 'f2' ? { state: 'ready', uri: 'data:image/webp;base64,AAAA' } : { state: 'none' },
      );
      jest.useRealTimers();
    }
  });

  it('searches the names', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('files-search-open'));
    await fireEvent.changeText(screen.getByTestId('files-search'), 'SCOPE');
    expect(screen.getByText('scope.png')).toBeTruthy();
    expect(screen.queryByText('notes.md')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('files-search'), 'nothing-like-it');
    expect(screen.getByText(/Nothing found/)).toBeTruthy();
  });

  it('uploads files from the phone into the folder that is open', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///scan.pdf', name: 'scan.pdf', mimeType: 'application/pdf' }],
    });
    await show();
    await fireEvent.press(screen.getByTestId('file-row-d:d1'));
    await fireEvent.press(screen.getByTestId('files-add'));
    expect(within(screen.getByTestId('upload-sheet')).getByText('Add to Datasheets')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('action-pick-files'));
    expect(client.upload).toHaveBeenCalledWith(
      [{ uri: 'file:///scan.pdf', name: 'scan.pdf', type: 'application/pdf' }],
      'd1',
      expect.anything(),
    );
    expect(await screen.findByText('Uploaded scan.pdf')).toBeTruthy();
  });

  it('renames, moves and deletes a file from its menu; delete asks and goes to Deleted files', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('file-more-f:f1'));
    await fireEvent.press(screen.getByTestId('action-rename'));
    await fireEvent.changeText(screen.getByTestId('dialog-input'), 'plan.md');
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(client.renameFile).toHaveBeenCalledWith('f1', 'plan.md');
    expect(await screen.findByText('plan.md')).toBeTruthy();

    await fireEvent(screen.getByTestId('file-row-f:f1'), 'longPress');
    await fireEvent.press(screen.getByTestId('action-move'));
    await fireEvent.press(screen.getByTestId('pick-folder-d2'));
    expect(client.moveFiles).toHaveBeenCalledWith(['f1'], [], 'd2');

    await fireEvent.press(screen.getByTestId('file-more-f:f1'));
    await fireEvent.press(screen.getByTestId('action-delete'));
    expect(screen.getByText('Delete this file?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(client.deleteFile).toHaveBeenCalledWith('f1');
    expect(screen.queryByText('plan.md')).toBeNull();
  });

  it('shows Deleted files with the days left, and restores one', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('files-tabs-trash'));
    expect(await screen.findByText('old.zip')).toBeTruthy();
    expect(screen.getByText('2.0 kB · 12 days left · from Datasheets')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('file-row-t:t1'));
    await fireEvent.press(screen.getByTestId('action-restore'));
    expect(client.restoreFiles).toHaveBeenCalledWith(['t1']);
    expect(await screen.findByText(/Nothing deleted/)).toBeTruthy();
  });

  it('keeps In the app read-only: a copy can be saved to My files, nothing renamed or deleted', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('files-tabs-app'));
    await fireEvent.press(screen.getByTestId('file-row-d:v:projects'));
    await fireEvent.press(screen.getByTestId('file-row-d:v:pf:a'));
    expect(screen.queryByTestId('files-add')).toBeNull();
    await fireEvent.press(screen.getByTestId('file-more-f:v:ms:1'));
    const sheet = within(screen.getByTestId('file-actions'));
    expect(sheet.queryByText('Rename')).toBeNull();
    expect(sheet.queryByText('Delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('action-copy'));
    await fireEvent.press(screen.getByTestId('pick-folder-d1'));
    expect(client.copyToMine).toHaveBeenCalledWith('v:ms:1', 'd1');
    expect(await screen.findByText('Saved a copy as board (1).step')).toBeTruthy();
  });

  it('a viewer only looks: no upload, no rename, move or delete', async () => {
    await show(['view']);
    expect(screen.queryByTestId('files-add')).toBeNull();
    await fireEvent.press(screen.getByTestId('file-more-f:f1'));
    const sheet = within(screen.getByTestId('file-actions'));
    expect(sheet.getByText('Share')).toBeTruthy();
    for (const no of ['Rename', 'Move', 'Delete']) expect(sheet.queryByText(no)).toBeNull();
  });

  it('opens a picture, a PDF as the server’s pages and Markdown as text, and shares a file', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('file-row-d:d1'));
    await fireEvent.press(screen.getByTestId('file-row-f:f2'));
    expect(screen.getByTestId('preview-image').props.source).toEqual({ uri: 'https://wb/api/files/f2?inline=1' });
    await fireEvent.press(screen.getByTestId('preview-share'));
    expect(share.shareFile).toHaveBeenCalledWith(expect.anything(), 'scope.png', 'image/png');
    await fireEvent.press(screen.getByTestId('preview-close'));

    await fireEvent.press(screen.getByTestId('file-row-f:f3'));
    expect(await screen.findByTestId('pdf-page-1')).toBeTruthy();
    // The page under the eye is in the header, not over the page's foot.
    expect(await screen.findByText(/Page 1 of 3/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('preview-close'));

    await fireEvent.press(screen.getByTestId('crumb-top'));
    await fireEvent.press(screen.getByTestId('file-row-f:f1'));
    expect(await screen.findByText('Notes')).toBeTruthy();
  });

  it('says what the server says when it refuses', async () => {
    (client.deleteFile as jest.Mock).mockRejectedValueOnce(new Error('as reviewer you cannot delete'));
    await show();
    await fireEvent.press(screen.getByTestId('file-more-f:f1'));
    await fireEvent.press(screen.getByTestId('action-delete'));
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(await screen.findByText('as reviewer you cannot delete')).toBeTruthy();
  });

  describe('a newer server', () => {
    const roots = {
      under: '',
      trail: [],
      folders: [
        folder('v:projects', 'Projects', '', { root: true, ro: true, count: { folders: 1, files: 0 } }),
        folder('v:chat', 'Chat', '', { root: true, ro: true, count: { folders: 1, files: 0 } }),
      ],
      files: [],
      links: [],
      linked: [],
    };
    const chat = {
      under: 'v:chat',
      trail: [{ id: 'v:chat', name: 'Chat' }],
      folders: [folder('v:cc:1', 'Rail check', 'v:chat', { ro: true, count: { folders: 0, files: 1 } })],
      files: [],
      links: [],
      linked: [],
    };
    const talk = {
      under: 'v:cc:1',
      trail: [
        { id: 'v:chat', name: 'Chat' },
        { id: 'v:cc:1', name: 'Rail check' },
      ],
      folders: [],
      files: [],
      links: [{ folder: 'v:cc:1', file: 'c1' }],
      linked: [file('c1', 'from-chat.jpg', 'x', { where: 'chat', ro: true })],
    };

    beforeEach(() => {
      const byId: Record<string, unknown> = { '': roots, 'v:chat': chat, 'v:cc:1': talk };
      (client.virtualFolder as jest.Mock).mockImplementation(async (id: string) => ({ folder: byId[id] }));
      (client.listFiles as jest.Mock).mockImplementation(async (own?: boolean) => (own ? files.filter((f) => !f.where) : files));
    });

    it('reads one’s own uploads only, and In the app a folder at a time with the server’s counts', async () => {
      await show();
      expect(client.listFiles).toHaveBeenCalledWith(true);
      expect(client.virtualFolder).toHaveBeenCalledWith('');
      await fireEvent.press(screen.getByTestId('files-tabs-app'));
      expect(within(screen.getByTestId('files-list')).getAllByText('1 folder')).toHaveLength(2);
      await fireEvent.press(screen.getByTestId('file-row-d:v:chat'));
      await act(async () => undefined);
      expect(client.virtualFolder).toHaveBeenLastCalledWith('v:chat');
      expect(screen.getByText('1 file')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('file-row-d:v:cc:1'));
      await act(async () => undefined);
      expect(screen.getByTestId('file-row-f:c1')).toBeTruthy();
      expect(client.virtualTree).not.toHaveBeenCalled();
      expect(client.listFiles).not.toHaveBeenCalledWith();
    });

    it('reads everything once for a search of In the app', async () => {
      await show();
      await fireEvent.press(screen.getByTestId('files-tabs-app'));
      await fireEvent.press(screen.getByTestId('files-search-open'));
      await fireEvent.changeText(screen.getByTestId('files-search'), 'board');
      await act(async () => undefined);
      expect(client.virtualTree).toHaveBeenCalledTimes(1);
      expect(await screen.findByTestId('file-row-f:v:ms:1')).toBeTruthy();
    });

    it('shows a large picture as the server’s sized copy, the original when it has none', async () => {
      files = [file('f2', 'scope.png', '', { preview: 'image', kind: 'image', bytes: 6_000_000 })];
      (client.previewUri as jest.Mock).mockResolvedValueOnce('data:image/webp;base64,AAAA');
      await show();
      await fireEvent.press(screen.getByTestId('file-row-f:f2'));
      await act(async () => undefined);
      expect(client.previewUri).toHaveBeenCalledWith('f2', expect.any(Number));
      expect(screen.getByTestId('preview-image').props.source).toEqual({ uri: 'data:image/webp;base64,AAAA' });
      await fireEvent.press(screen.getByTestId('preview-close'));
      await fireEvent.press(screen.getByTestId('file-row-f:f2'));
      await act(async () => undefined);
      expect(screen.getByTestId('preview-image').props.source).toEqual({ uri: 'https://wb/api/files/f2?inline=1' });
    });
  });
});
