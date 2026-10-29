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
  move: string;
  /** The dialog that renames a file or a folder: its button and its field. */
  save: string;
  make: string;
  nameLabel: string;
  /** "“bom.csv” and everything in it go to Deleted files, kept 30 days." */
  deleteFileText: (name: string, days: number) => string;
  deleteFolderText: (name: string, days: number) => string;
  /** Emptying it for good, from Deleted files. */
  foreverQ: string;
  foreverText: (name: string) => string;
  moved: string;
  movedToDeleted: string;
  restored: (name: string, folder: string) => string;
  // An upload
  /** "Uploading bom.csv (2 of 5)…" while it goes. */
  uploading: (name: string, at: number, of: number) => string;
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
  readingTable: string;
  /** Under a table the server cut: "The first 500 of 4200 rows are shown." */
  rowsShown: (shown: number, total: number) => string;
  loadingPicture: string;
  readingPdf: string;
  readingFile: string;
  /** One file's own text could not be read. */
  fileUnreadable: string;
  nextPage: string;
  prevPage: string;
  close: string;
  openFile: string;
  /** An upload under way, and the empty list's own button. */
  stopUpload: string;
  readingThese: string;
  retry: string;
  /** Under Deleted: how long it stays before it is gone. */
  keptDays: (n: number) => string;
  // The picture of a file that is not drawn here
  more: string;
  shareOpen: string;
  opensElsewhere: string;
  openOrShare: string;
  /** The text is longer than the server sends: "The first 402 kB are shown." */
  firstShown: (size: string) => string;
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
  move: 'Move',
  save: 'Save',
  make: 'Make',
  nameLabel: 'Name',
  deleteFileText: (name, days) =>
    `“${name}” goes to Deleted files, kept ${days} days. Where it was used, it shows as deleted.`,
  deleteFolderText: (name, days) => `“${name}” and everything in it go to Deleted files, kept ${days} days.`,
  foreverQ: 'Delete forever?',
  foreverText: (name) => `“${name}” is deleted for good. This cannot be undone.`,
  moved: 'Moved',
  movedToDeleted: 'Moved to Deleted files',
  restored: (name, folder) => `${name} is back in ${folder}`,
  uploading: (name, at, of) => `Uploading ${name}${of > 1 ? ` (${at} of ${of})` : ''}…`,
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
  readingTable: 'Reading the table',
  rowsShown: (shown, total) => `The first ${shown} of ${total} rows are shown.`,
  loadingPicture: 'Loading the picture',
  readingPdf: 'Reading the PDF',
  readingFile: 'Reading the file',
  fileUnreadable: 'The file could not be read.',
  nextPage: 'Next page',
  prevPage: 'Previous page',
  close: 'Close',
  openFile: 'Open the file',
  stopUpload: 'Stop',
  readingThese: 'Reading the files',
  retry: 'Try again',
  keptDays: (n) => `Kept ${n} days, then deleted for good.`,
  more: 'More',
  shareOpen: 'Share or open in another app',
  opensElsewhere: 'This file opens in another app on the phone.',
  openOrShare: 'Open or share',
  firstShown: (size) => `The first ${size} are shown. Share it to read the rest.`,
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
  move: 'Taşı',
  save: 'Kaydet',
  make: 'Oluştur',
  nameLabel: 'Ad',
  deleteFileText: (name, days) =>
    `“${name}” Silinenler’e gider ve ${days} gün orada kalır. Kullanıldığı yerlerde silinmiş görünür.`,
  deleteFolderText: (name, days) => `“${name}” ve içindeki her şey Silinenler’e gider ve ${days} gün orada kalır.`,
  foreverQ: 'Kalıcı olarak silinsin mi?',
  foreverText: (name) => `“${name}” kalıcı olarak silinir. Bu geri alınamaz.`,
  moved: 'Taşındı',
  movedToDeleted: 'Silinenler’e taşındı',
  restored: (name, folder) => `${name} yine ${folder} içinde`,
  uploading: (name, at, of) => `${name} yükleniyor${of > 1 ? ` (${at}/${of})` : ''}…`,
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
  readingTable: 'Tablo okunuyor',
  rowsShown: (shown, total) => `${total} satırın ilk ${shown} tanesi gösteriliyor.`,
  loadingPicture: 'Fotoğraf yükleniyor',
  readingPdf: 'PDF okunuyor',
  readingFile: 'Dosya okunuyor',
  fileUnreadable: 'Dosya okunamadı.',
  nextPage: 'Sonraki sayfa',
  prevPage: 'Önceki sayfa',
  close: 'Kapat',
  openFile: 'Dosyayı aç',
  stopUpload: 'Durdur',
  readingThese: 'Dosyalar okunuyor',
  retry: 'Yeniden dene',
  keptDays: (n) => `${n} gün saklanır, sonra kalıcı olarak silinir.`,
  more: 'Daha fazla',
  shareOpen: 'Paylaş ya da başka bir uygulamada aç',
  opensElsewhere: 'Bu dosya telefonda başka bir uygulamada açılır.',
  openOrShare: 'Aç ya da paylaş',
  firstShown: (size) => `İlk ${size} gösteriliyor. Kalanını okumak için paylaşın.`,
};

export function filesStrings(lang: UiLang): FilesStrings {
  return lang === 'tr' ? tr : en;
}
