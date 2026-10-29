/**
 * What the Files room says, in English and Turkish: its sides, the actions on a
 * file, what an upload says while it is going and after, the empty states and
 * the words a screen reader reads out. The Turkish is the web app's own where
 * it has the same words (frontend/src/app/i18n.ts).
 */
import type { UiLang } from '../update/strings';

export interface FilesStrings {
  mine: string;
  inApp: string;
  deleted: string;
  // What went wrong, each about one thing.
  couldNotRead: string;
  deletedCouldNotRead: string;
  folderCouldNotRead: string;
  searchFailed: string;
  notRestored: string;
  notShared: string;
  notSaved: string;
  uploadFailed: string;
  cameraBlocked: string;
  filesUnreadable: string;
  photosUnreadable: string;
  cameraNotOpened: string;
  didNotWork: string;
  // The actions
  restore: string;
  deleteForever: string;
  share: string;
  saveToPhone: string;
  saveToMine: string;
  rename: string;
  delete: string;
  moved: string;
  movedToDeleted: string;
  restored: (name: string, folder: string) => string;
  // An upload
  uploadedOne: (name: string) => string;
  uploadedMany: (n: number) => string;
  stoppedAt: (done: number, all: number) => string;
  stoppedNothing: string;
  uploadPartial: (done: number, all: number, failed: number) => string;
  // Empty states and counts
  emptyFolder: string;
  emptyNothing: string;
  emptyNoFiles: string;
  nothingFound: (q: string) => string;
  nothingDeleted: string;
  // The bar
  searchDeleted: string;
  searchApp: string;
  searchMine: string;
  search: string;
  closeSearch: string;
  upload: string;
  title: string;
  addTo: (folder: string) => string;
  filesOnPhone: string;
  photosVideos: string;
  takePhoto: string;
  newFolder: string;
  saveToMineTitle: string;
  moveTo: string;
  deleteFolderQ: string;
  deleteFileQ: string;
  newFolderName: string;
  reading: string;
  // The picture of a file
  notes: string;
  pageOf: (n: number, of: number) => string;
  nextPage: string;
  prevPage: string;
  close: string;
  openFile: string;
}

const en: FilesStrings = {
  mine: 'My files',
  inApp: 'In the app',
  deleted: 'Deleted',
  couldNotRead: 'Files could not be read.',
  deletedCouldNotRead: 'Deleted files could not be read.',
  folderCouldNotRead: 'This folder could not be read.',
  searchFailed: 'Files could not be searched.',
  notRestored: 'It could not be restored.',
  notShared: 'It could not be shared.',
  notSaved: 'It could not be saved.',
  uploadFailed: 'The upload did not go through.',
  cameraBlocked: 'The camera is not allowed for Workbench. Allow it in the phone’s settings.',
  filesUnreadable: 'The files could not be read.',
  photosUnreadable: 'The photos could not be read.',
  cameraNotOpened: 'The camera could not be opened.',
  didNotWork: 'That did not work.',
  restore: 'Restore',
  deleteForever: 'Delete forever',
  share: 'Share',
  saveToPhone: 'Save to phone',
  saveToMine: 'Save to My files',
  rename: 'Rename',
  delete: 'Delete',
  moved: 'Moved',
  movedToDeleted: 'Moved to Deleted files',
  restored: (name, folder) => `${name} is back in ${folder}`,
  uploadedOne: (name) => `Uploaded ${name}`,
  uploadedMany: (n) => `Uploaded ${n} files`,
  stoppedAt: (done, all) => `Stopped: ${done} of ${all} files uploaded`,
  stoppedNothing: 'Stopped: nothing was uploaded',
  uploadPartial: (done, all, failed) =>
    `${done} of ${all} files uploaded; ${failed === 1 ? 'one did not go through' : `${failed} did not go through`}`,
  emptyFolder: 'This folder is empty.',
  emptyNothing: 'Nothing here yet.',
  emptyNoFiles: 'No files yet.',
  nothingFound: (q) => `Nothing found for “${q}”.`,
  nothingDeleted: 'Nothing deleted.',
  searchDeleted: 'Search deleted files',
  searchApp: 'Search In the app',
  searchMine: 'Search My files',
  search: 'Search the files',
  closeSearch: 'Close the search',
  upload: 'Upload or make a folder',
  title: 'Files',
  addTo: (folder) => `Add to ${folder}`,
  filesOnPhone: 'Files on the phone',
  photosVideos: 'Photos and videos',
  takePhoto: 'Take a photo',
  newFolder: 'New folder',
  saveToMineTitle: 'Save to My files',
  moveTo: 'Move to',
  deleteFolderQ: 'Delete this folder?',
  deleteFileQ: 'Delete this file?',
  newFolderName: 'Name',
  reading: 'Reading the files',
  notes: 'Notes',
  pageOf: (n, of) => `Page ${n} of ${of}`,
  nextPage: 'Next page',
  prevPage: 'Previous page',
  close: 'Close',
  openFile: 'Open the file',
};

const tr: FilesStrings = {
  mine: 'Dosyalarım',
  inApp: 'Uygulamada',
  deleted: 'Silinenler',
  couldNotRead: 'Dosyalar okunamadı.',
  deletedCouldNotRead: 'Silinen dosyalar okunamadı.',
  folderCouldNotRead: 'Bu klasör okunamadı.',
  searchFailed: 'Dosyalarda arama yapılamadı.',
  notRestored: 'Geri getirilemedi.',
  notShared: 'Paylaşılamadı.',
  notSaved: 'Kaydedilemedi.',
  uploadFailed: 'Yükleme tamamlanmadı.',
  cameraBlocked: 'Workbench için kamera izni yok. Telefonun ayarlarından izin verin.',
  filesUnreadable: 'Dosyalar okunamadı.',
  photosUnreadable: 'Fotoğraflar okunamadı.',
  cameraNotOpened: 'Kamera açılamadı.',
  didNotWork: 'Bu iş olmadı.',
  restore: 'Geri getir',
  deleteForever: 'Kalıcı olarak sil',
  share: 'Paylaş',
  saveToPhone: 'Telefona kaydet',
  saveToMine: 'Dosyalarıma kaydet',
  rename: 'Adını değiştir',
  delete: 'Sil',
  moved: 'Taşındı',
  movedToDeleted: 'Silinenler’e taşındı',
  restored: (name, folder) => `${name} yine ${folder} içinde`,
  uploadedOne: (name) => `${name} yüklendi`,
  uploadedMany: (n) => `${n} dosya yüklendi`,
  stoppedAt: (done, all) => `Durduruldu: ${all} dosyanın ${done} tanesi yüklendi`,
  stoppedNothing: 'Durduruldu: hiçbir şey yüklenmedi',
  uploadPartial: (done, all, failed) => `${all} dosyanın ${done} tanesi yüklendi; ${failed} tanesi geçmedi`,
  emptyFolder: 'Bu klasör boş.',
  emptyNothing: 'Henüz bir şey yok.',
  emptyNoFiles: 'Henüz dosya yok.',
  nothingFound: (q) => `“${q}” için bir şey bulunamadı.`,
  nothingDeleted: 'Silinen bir şey yok.',
  searchDeleted: 'Silinenlerde ara',
  searchApp: 'Uygulamada ara',
  searchMine: 'Dosyalarımda ara',
  search: 'Dosyalarda ara',
  closeSearch: 'Aramayı kapat',
  upload: 'Yükle ya da klasör aç',
  title: 'Dosyalar',
  addTo: (folder) => `${folder} içine ekle`,
  filesOnPhone: 'Telefondaki dosyalar',
  photosVideos: 'Fotoğraflar ve videolar',
  takePhoto: 'Fotoğraf çek',
  newFolder: 'Yeni klasör',
  saveToMineTitle: 'Dosyalarıma kaydet',
  moveTo: 'Şuraya taşı',
  deleteFolderQ: 'Bu klasör silinsin mi?',
  deleteFileQ: 'Bu dosya silinsin mi?',
  newFolderName: 'Ad',
  reading: 'Dosyalar okunuyor',
  notes: 'Notlar',
  pageOf: (n, of) => `Sayfa ${n} / ${of}`,
  nextPage: 'Sonraki sayfa',
  prevPage: 'Önceki sayfa',
  close: 'Kapat',
  openFile: 'Dosyayı aç',
};

export function filesStrings(lang: UiLang): FilesStrings {
  return lang === 'tr' ? tr : en;
}
