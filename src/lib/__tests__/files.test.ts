import type { FileFolder, StoredFile, VirtualFolder, VirtualTree } from '../../api/types';
import {
  appAt,
  appMissing,
  countIn,
  crumbs,
  folderChoices,
  hasMini,
  iconOf,
  mayDelete,
  mineAt,
  previewWorth,
  rightsOf,
  search,
  searchTrash,
  size,
  under,
  viewerOf,
  type FilesData,
} from '../files';

const file = (id: string, name: string, folder = '', extra: Partial<StoredFile> = {}): StoredFile => ({
  id,
  name,
  folder,
  bytes: 1000,
  kind: 'other',
  preview: 'none',
  created_at: '2026-10-01T10:00:00Z',
  by: { id: 'u1', name: 'Ada' },
  ...extra,
});
const folder = (id: string, name: string, parent = '', extra: Partial<FileFolder> = {}): FileFolder => ({
  id,
  name,
  parent,
  ...extra,
});

const tree: VirtualTree = {
  folders: [
    folder('v:projects', 'Projects', '', { root: true, ro: true }),
    folder('v:chat', 'Chat', '', { root: true, ro: true }),
    folder('v:pf:a', 'Sensor board', 'v:projects', { ro: true }),
    folder('v:cc:2', 'Zeta talk', 'v:chat', { ro: true }),
    folder('v:cc:1', 'Alpha talk', 'v:chat', { ro: true }),
  ],
  files: [file('v:ms:1', 'board.step', 'v:pf:a', { ro: true, kind: 'step', preview: 'step' })],
  links: [{ folder: 'v:cc:1', file: 'c9' }],
};

const data: FilesData = {
  files: [
    file('f1', 'b-notes.md', '', { preview: 'markdown', kind: 'text' }),
    file('f2', 'A-scope.png', 'd1', { preview: 'image', kind: 'image' }),
    file('f3', 'lost.txt', 'gone-folder'),
    file('c9', 'chat-photo.jpg', 'chatfolder', { where: 'chat', ro: true, preview: 'image', kind: 'image' }),
  ],
  folders: [
    folder('d1', 'Datasheets'),
    folder('d2', 'Rev C', 'd1'),
    folder('d0', 'archive'),
    folder('chatfolder', 'Chat', '', { ro: true, where: 'chat' }),
  ],
  tree,
};

describe('My files', () => {
  it('lists the top: own folders by name, own files (and those whose folder is gone), never the app’s', () => {
    const top = mineAt(data, '');
    expect(top.folders.map((f) => f.name)).toEqual(['archive', 'Datasheets']);
    expect(top.files.map((f) => f.name)).toEqual(['b-notes.md', 'lost.txt']);
  });

  it('lists a folder and the way back to it', () => {
    const at = mineAt(data, 'd1');
    expect(at.folders.map((f) => f.id)).toEqual(['d2']);
    expect(at.files.map((f) => f.id)).toEqual(['f2']);
    expect(crumbs(data, 'mine', 'd2')).toEqual([
      { id: '', name: 'My files' },
      { id: 'd1', name: 'Datasheets' },
      { id: 'd2', name: 'Rev C' },
    ]);
    expect(countIn(data, 'mine', 'd1')).toBe('1 folder, 1 file');
    expect(countIn(data, 'mine', 'd0')).toBe('0 files');
  });
});

describe('In the app', () => {
  it('starts at the roots and keeps the conversations in the server’s order', () => {
    expect(appAt(data, '').folders.map((f) => f.name)).toEqual(['Projects', 'Chat']);
    expect(appAt(data, 'v:chat').folders.map((f) => f.name)).toEqual(['Zeta talk', 'Alpha talk']);
  });

  it('holds its own files and the uploads its folders refer to, all read-only', () => {
    expect(appAt(data, 'v:pf:a').files.map((f) => [f.name, f.ro])).toEqual([['board.step', true]]);
    expect(appAt(data, 'v:cc:1').files.map((f) => [f.id, f.ro])).toEqual([['c9', true]]);
    expect(crumbs(data, 'app', 'v:pf:a').map((c) => c.name)).toEqual(['In the app', 'Projects', 'Sensor board']);
  });

  it('is empty without the server’s tree (an older server)', () => {
    expect(appAt({ ...data, tree: null }, '')).toEqual({ folders: [], files: [] });
  });
});

describe('search', () => {
  it('finds own files and folders on My files, and the app’s on In the app', () => {
    expect(search(data, 'mine', 'a').files.map((f) => f.id)).toEqual(['f2']);
    expect(search(data, 'mine', 'DATA').folders.map((f) => f.id)).toEqual(['d1']);
    expect(search(data, 'app', 'photo').files.map((f) => f.id)).toEqual(['c9']);
    expect(search(data, 'app', 'step').files.map((f) => f.id)).toEqual(['v:ms:1']);
    expect(search(data, 'mine', ' ')).toEqual({ folders: [], files: [] });
    const t = [{ ...file('t1', 'old.pdf'), deleted_at: '', purge_at: '', folder_path: '', days_left: 3 }];
    expect(searchTrash(t, 'OLD')).toHaveLength(1);
    expect(searchTrash(t, 'new')).toHaveLength(0);
  });
});

describe('folders to move into', () => {
  it('lists My files and every own folder with its path, deepest under their parents', () => {
    expect(folderChoices(data.folders).map((c) => [c.path, c.depth])).toEqual([
      ['My files', 0],
      ['My files/archive', 1],
      ['My files/Datasheets', 1],
      ['My files/Datasheets/Rev C', 2],
    ]);
  });
  it('never offers a folder itself or what is under it', () => {
    expect([...under(data.folders, 'd1')].sort()).toEqual(['d1', 'd2']);
  });
});

describe('rights', () => {
  it('reads the role’s actions', () => {
    expect(rightsOf(['view'])).toEqual({ change: false, delete: false });
    expect(rightsOf(['view', 'draw'])).toEqual({ change: true, delete: false });
    expect(rightsOf(['view', 'draw', 'delete'])).toEqual({ change: true, delete: true });
  });
  it('lets one delete one’s own files, anyone’s with the delete right, and never the app’s', () => {
    const own = file('x', 'x', '', { by: { id: 'u1' } });
    const theirs = file('y', 'y', '', { by: { id: 'u2' } });
    const reviewer = rightsOf(['view', 'draw']);
    expect(mayDelete(own, reviewer, 'u1')).toBe(true);
    expect(mayDelete(theirs, reviewer, 'u1')).toBe(false);
    expect(mayDelete(theirs, rightsOf(['draw', 'delete']), 'u1')).toBe(true);
    expect(mayDelete({ ...own, where: 'chat' }, rightsOf(['draw', 'delete']), 'u1')).toBe(false);
    expect(mayDelete(own, rightsOf(['view']), 'u1')).toBe(false);
  });
});

describe('how a file is shown', () => {
  it.each([
    [{ name: 'a.png', preview: 'image' }, 'image', true],
    [{ name: 'a.svg', preview: 'image' }, 'text', false],
    [{ name: 'a.pdf', preview: 'pdf' }, 'pdf', true],
    [{ name: 'a.md', preview: 'markdown' }, 'markdown', false],
    [{ name: 'a.py', preview: 'text' }, 'text', false],
    [{ name: 'bom.csv', preview: 'table' }, 'table', false],
    [{ name: 'a.step', preview: 'step' }, 'other', true],
    [{ name: 'a.stl', preview: 'mesh' }, 'other', true],
    [{ name: 'a.obj', preview: 'mesh' }, 'other', false],
    [{ name: 'a.mp4', preview: 'video' }, 'other', false],
  ])('%j is %s, with a picture: %s', (f, viewer, mini) => {
    expect(viewerOf(f)).toBe(viewer);
    expect(hasMini(f)).toBe(mini);
  });

  it('picks an icon by kind and writes sizes as the web app does', () => {
    expect(iconOf({ kind: 'bom', name: 'b.csv' })).toBe('table');
    expect(iconOf({ kind: 'text', name: 'main.py' })).toBe('code');
    expect(iconOf({ kind: 'step', name: 'a.step' })).toBe('model');
    expect(iconOf({ kind: 'weird', name: 'a.bin' })).toBe('file');
    expect(size(512)).toBe('512 B');
    expect(size(2048)).toBe('2.0 kB');
    expect(size(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('In the app, one folder at a time (a newer server)', () => {
  const roots: VirtualFolder = {
    under: '',
    trail: [],
    folders: [
      folder('v:projects', 'Projects', '', { root: true, ro: true, count: { folders: 3, files: 0 } }),
      folder('v:chat', 'Chat', '', { root: true, ro: true, count: { folders: 2, files: 0 } }),
    ],
    files: [],
    links: [],
    linked: [],
  };
  const talk: VirtualFolder = {
    under: 'v:cc:1',
    trail: [
      { id: 'v:chat', name: 'Chat' },
      { id: 'v:cc:1', name: 'Alpha talk' },
    ],
    folders: [],
    files: [],
    links: [
      { folder: 'v:cc:1', file: 'c9' },
      { folder: 'v:cc:1', file: 'gone' },
    ],
    linked: [file('c9', 'chat-photo.jpg', 'chatfolder', { where: 'chat', preview: 'image', kind: 'image' })],
  };
  const lean: FilesData = { files: [], folders: [], tree: null, app: { '': roots, 'v:cc:1': talk } };

  it('lists what was read, the uploads from the folder’s own rows, read-only', () => {
    expect(appAt(lean, '').folders.map((f) => f.name)).toEqual(['Projects', 'Chat']);
    expect(appAt(lean, 'v:cc:1').files.map((f) => [f.id, f.ro])).toEqual([['c9', true]]);
    expect(crumbs(lean, 'app', 'v:cc:1').map((c) => c.name)).toEqual(['In the app', 'Chat', 'Alpha talk']);
  });

  it('counts a folder as the server counted it until it is read', () => {
    expect(countIn(lean, 'app', 'v:chat', { folders: 2, files: 0 })).toBe('2 folders');
    expect(countIn(lean, 'app', 'v:cc:1', { folders: 0, files: 9 })).toBe('1 file');
  });

  it('knows which folders are still to be read', () => {
    expect(appMissing(lean, 'v:chat')).toBe(true);
    expect(appMissing(lean, 'v:cc:1')).toBe(false);
    expect(appMissing({ ...lean, tree }, 'v:chat')).toBe(false);
    expect(appMissing(data, 'v:chat')).toBe(false);
  });

  it('searches every upload once the whole tree was read for it', () => {
    const all = { ...lean, tree, every: data.files };
    expect(search(all, 'app', 'photo').files.map((f) => f.id)).toEqual(['c9']);
  });
});

describe('a picture’s sized copy', () => {
  it('is asked for a large picture only, never for a GIF', () => {
    const big = { preview: 'image' as const, kind: 'image', bytes: 5_000_000 };
    expect(previewWorth({ name: 'a.jpg', ...big })).toBe(true);
    expect(previewWorth({ name: 'a.gif', ...big })).toBe(false);
    expect(previewWorth({ name: 'a.jpg', ...big, bytes: 90_000 })).toBe(false);
    expect(previewWorth({ name: 'a.pdf', preview: 'pdf', bytes: 5_000_000 })).toBe(false);
  });
});
