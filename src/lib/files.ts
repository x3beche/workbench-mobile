/**
 * What the Files screen shows, worked out from what the server lists - the
 * same way the web app's Files room does (frontend rooms/files.ts):
 *
 *   My files    one's own uploads (no `where`) in one's own folders (no `ro`)
 *   In the app  the read-only folders (GET /api/files/virtual): their own
 *               files, and the uploads their folders refer to (`links`)
 *
 * A file whose folder is gone, or from before folders, is at the top of My
 * files. Pure: no network, no React.
 */
import type { FileFolder, StoredFile, TrashFile, VirtualTree, Who } from '../api/types';

export type Side = 'mine' | 'app' | 'trash';

export interface Listing {
  folders: FileFolder[];
  files: StoredFile[];
}

export interface FilesData {
  files: StoredFile[];
  folders: FileFolder[];
  tree: VirtualTree | null;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

export const isVirtual = (id: string | null | undefined): boolean => !!id && id.startsWith('v:');

/** One's own uploads: the Chat's, the Parts page's and the agents' are In the app. */
export function mine(files: StoredFile[]): StoredFile[] {
  return files.filter((f) => !f.where);
}

/** What is in a folder of My files ("" the top). */
export function mineAt(data: FilesData, here: string): Listing {
  const own = data.folders.filter((f) => !f.ro);
  const known = new Set(own.map((f) => f.id));
  const parentOf = (f: FileFolder) => (known.has(f.parent) ? f.parent : '');
  return {
    folders: own.filter((f) => parentOf(f) === here).sort(byName),
    files: mine(data.files)
      .filter((f) => (known.has(f.folder) ? f.folder : '') === here)
      .sort(byName),
  };
}

/** What is in a read-only folder; "" is the list of roots (Projects, Chat, Parts, ...). */
export function appAt(data: FilesData, here: string): Listing {
  const tree = data.tree;
  if (!tree) return { folders: [], files: [] };
  if (!here) return { folders: tree.folders.filter((f) => f.root), files: [] };
  const real = new Map(data.files.map((f) => [f.id, f]));
  const dirs = tree.folders.filter((f) => !f.root && f.parent === here);
  // The conversations keep the server's order (the latest first); the rest go by name.
  if (here !== 'v:chat') dirs.sort(byName);
  const files = [
    ...tree.files.filter((f) => f.folder === here),
    ...tree.links
      .filter((l) => l.folder === here)
      .map((l) => real.get(l.file))
      .filter((f): f is StoredFile => !!f),
  ].map((f) => ({ ...f, ro: true }));
  return { folders: dirs, files: files.sort(byName) };
}

/** The way from the side's top to a folder, the top first; each is [id, name]. */
export function crumbs(data: FilesData, side: Side, here: string): { id: string; name: string }[] {
  const top = { id: '', name: side === 'app' ? 'In the app' : side === 'trash' ? 'Deleted files' : 'My files' };
  if (!here || side === 'trash') return [top];
  const all = side === 'app' ? (data.tree?.folders ?? []) : data.folders;
  const byId = new Map(all.map((f) => [f.id, f]));
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  let at = byId.get(here);
  while (at && !seen.has(at.id) && out.length < 40) {
    seen.add(at.id);
    out.unshift({ id: at.id, name: at.name });
    at = byId.get(at.parent);
  }
  return [top, ...out];
}

/** Files and folders whose names hold `q`, on one side (In the app searches its own files and links too). */
export function search(data: FilesData, side: Side, q: string): Listing {
  const words = q.trim().toLowerCase();
  if (!words) return { folders: [], files: [] };
  const hit = (name: string) => name.toLowerCase().includes(words);
  if (side === 'app') {
    const linked = new Set(data.tree?.links.map((l) => l.file) ?? []);
    const files = [...(data.tree?.files ?? []), ...data.files.filter((f) => linked.has(f.id) || !!f.where)];
    const seen = new Set<string>();
    return {
      folders: (data.tree?.folders ?? []).filter((f) => !f.root && hit(f.name)).sort(byName),
      files: files
        .filter((f) => hit(f.name) && !seen.has(f.id) && (seen.add(f.id), true))
        .map((f) => ({ ...f, ro: true }))
        .sort(byName),
    };
  }
  return {
    folders: data.folders.filter((f) => !f.ro && hit(f.name)).sort(byName),
    files: mine(data.files)
      .filter((f) => hit(f.name))
      .sort(byName),
  };
}

export function searchTrash(files: TrashFile[], q: string): TrashFile[] {
  const words = q.trim().toLowerCase();
  return words ? files.filter((f) => f.name.toLowerCase().includes(words)) : files;
}

/** How many folders and files a folder of My files holds directly - "3 folders, 12 files". */
export function countIn(data: FilesData, side: Side, id: string): string {
  const got = side === 'app' ? appAt(data, id) : mineAt(data, id);
  const parts: string[] = [];
  if (got.folders.length) parts.push(plural(got.folders.length, 'folder'));
  if (got.files.length || !got.folders.length) parts.push(plural(got.files.length, 'file'));
  return parts.join(', ');
}

/** The folders of My files, each with its whole path, for "Move to" and "Save to My files". */
export function folderChoices(folders: FileFolder[]): { id: string; name: string; depth: number; path: string }[] {
  const own = folders.filter((f) => !f.ro);
  const known = new Set(own.map((f) => f.id));
  const kids = new Map<string, FileFolder[]>();
  for (const f of own) {
    const p = known.has(f.parent) ? f.parent : '';
    kids.set(p, [...(kids.get(p) ?? []), f]);
  }
  const out: { id: string; name: string; depth: number; path: string }[] = [
    { id: '', name: 'My files', depth: 0, path: 'My files' },
  ];
  const walk = (parent: string, depth: number, path: string) => {
    for (const f of (kids.get(parent) ?? []).sort(byName)) {
      const here = `${path}/${f.name}`;
      out.push({ id: f.id, name: f.name, depth, path: here });
      if (depth < 12) walk(f.id, depth + 1, here);
    }
  };
  walk('', 1, 'My files');
  return out;
}

/** Folders a folder may not be moved into: itself and everything under it. */
export function under(folders: FileFolder[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (!out.has(f.id) && out.has(f.parent)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

// ---- rights -------------------------------------------------------------

export interface Rights {
  /** Upload, rename, move, make folders, save copies (the server's "draw"). */
  change: boolean;
  /** Delete someone else's files (one's own are always one's to delete). */
  delete: boolean;
}

export function rightsOf(can: string[] | undefined | null): Rights {
  const has = new Set(can ?? []);
  return { change: has.has('draw'), delete: has.has('delete') };
}

/** May this person delete this file: their own with "draw", anyone's with "delete". */
export function mayDelete(f: { by?: Who; ro?: boolean; where?: string }, rights: Rights, userId?: string): boolean {
  if (f.ro || f.where || !rights.change) return false;
  return rights.delete || (!!userId && f.by?.id === userId);
}

// ---- how a file is told -------------------------------------------------

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

const CODE_EXT = new Set([
  'py',
  'c',
  'h',
  'cpp',
  'hpp',
  'cc',
  'ino',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'yaml',
  'yml',
  'ato',
  'xml',
  'toml',
  'ini',
  'cfg',
  'sh',
  'rs',
  'go',
  'java',
  'css',
  'html',
  'sql',
  'ld',
  's',
  'lua',
  'kicad_pcb',
  'kicad_sch',
  'net',
  'svg',
]);

export type FileIcon =
  'folder' | 'image' | 'video' | 'audio' | 'pdf' | 'table' | 'archive' | 'model' | 'board' | 'code' | 'text' | 'file';

/** The icon a file is drawn with, by its kind (as the web app's iconOf). */
export function iconOf(f: { kind: string; name: string; preview?: string }): FileIcon {
  const ext = extOf(f.name);
  if (f.preview === 'markdown') return 'text';
  if (['bom', 'pick-place', 'table'].includes(f.kind)) return 'table';
  if (f.kind === 'step' || f.kind === 'mesh') return 'model';
  if (f.kind === 'gerber' || f.kind === 'drill') return 'board';
  if (f.kind === 'text') return CODE_EXT.has(ext) ? 'code' : 'text';
  if (['image', 'video', 'audio', 'pdf', 'archive'].includes(f.kind)) return f.kind as FileIcon;
  return 'file';
}

/** Files the server draws a small picture of (backend/file_minis.py kind_of). */
export function hasMini(f: { name: string; preview?: string }): boolean {
  const ext = extOf(f.name);
  if (f.preview === 'image') return ext !== 'svg';
  if (f.preview === 'pdf' || f.preview === 'step') return true;
  return f.preview === 'mesh' && (ext === 'stl' || ext === 'glb');
}

/** How the app shows a file: as a picture, PDF pages, text, a table, or not at all (another app opens it). */
export type Viewer = 'image' | 'pdf' | 'markdown' | 'text' | 'table' | 'other';

export function viewerOf(f: { name: string; preview?: string; kind?: string }): Viewer {
  const ext = extOf(f.name);
  if (f.preview === 'image' && ext !== 'svg') return 'image';
  if (f.preview === 'pdf') return 'pdf';
  if (f.preview === 'markdown') return 'markdown';
  if (f.preview === 'table') return 'table';
  if (f.preview === 'text' || ext === 'svg' || CODE_EXT.has(ext)) return 'text';
  return 'other';
}

export function size(b: number): string {
  if (!Number.isFinite(b) || b < 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} kB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The type a picked file is sent as, when the phone did not say. */
export function typeOf(name: string): string {
  const ext = extOf(name);
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    zip: 'application/zip',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    step: 'model/step',
    stp: 'model/step',
    stl: 'model/stl',
  };
  return map[ext] ?? 'application/octet-stream';
}
