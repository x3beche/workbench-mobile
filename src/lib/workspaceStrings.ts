/**
 * What the workspace says when something is done or fails - the toast under
 * the drawer, and the dialogs that ask before a conversation goes - in English
 * and Turkish. The Turkish is the web app's own where it has the same words
 * (frontend/src/app/i18n.ts).
 */
import type { UiLang } from '../update/strings';

export type BulkAction = 'archive' | 'unarchive' | 'restore' | 'delete' | 'forever' | 'empty';

export interface WorkspaceStrings {
  // A toast after something that worked
  movedToTrash: string;
  renamed: string;
  pinned: string;
  restored: (title: string) => string;
  exported: (name: string) => string;
  keptBack: (n: number) => string;
  /** "3 conversations archived", "1 moved to Trash" - and what did not go. */
  bulk: (what: BulkAction, n: number, failed: number) => { text: string; bad: boolean };
  // The dialogs
  rename: string;
  save: string;
  name: string;
  deleteTitle: string;
  deleteText: (title: string, days: number) => string;
  deleteManyTitle: (n: number) => string;
  deleteManyText: (days: number) => string;
  foreverTitle: string;
  foreverText: (title: string) => string;
  foreverManyTitle: (n: number) => string;
  foreverManyText: string;
  emptyTitle: string;
  emptyText: string;
  emptyConfirm: string;
  delete: string;
  deleteForever: string;
  // What failed
  couldNotPin: string;
  couldNotRestore: string;
  couldNotExport: string;
}

function enVariants(what: BulkAction, n: number): string {
  const conversations = n === 1 ? 'conversation' : 'conversations';
  switch (what) {
    case 'archive':
      return `${n} ${conversations} archived`;
    case 'unarchive':
      return `${n} ${conversations} back in Conversations`;
    case 'restore':
      return `${n} ${conversations} restored`;
    case 'delete':
      return `${n} moved to Trash`;
    case 'forever':
      return `${n} deleted for good`;
    case 'empty':
      return 'The trash is empty';
  }
}

function trVariants(what: BulkAction, n: number): string {
  switch (what) {
    case 'archive':
      return `${n} sohbet arşivlendi`;
    case 'unarchive':
      return `${n} sohbet Sohbetler’e geri döndü`;
    case 'restore':
      return `${n} sohbet geri getirildi`;
    case 'delete':
      return `${n} Çöp’e taşındı`;
    case 'forever':
      return `${n} sohbet kalıcı olarak silindi`;
    case 'empty':
      return 'Çöp kutusu boş';
  }
}

const en: WorkspaceStrings = {
  movedToTrash: 'Moved to Trash',
  renamed: 'Renamed',
  pinned: 'Pinned',
  restored: (title) => `“${title}” is back`,
  exported: (name) => `Exported to Chat/Exports: ${name}`,
  keptBack: (n) =>
    `${n} kept: only their authors or someone who may delete can remove them.`,
  bulk: (what, n, failed) => {
    const done = enVariants(what, n);
    if (!failed) return { text: done, bad: false };
    const stayed = failed === 1 ? 'one conversation' : `${failed} conversations`;
    if (!n) return { text: `Nothing changed: ${stayed} could not be reached.`, bad: true };
    return { text: `${done}; ${stayed} could not be reached and stayed.`, bad: true };
  },
  rename: 'Rename',
  save: 'Save',
  name: 'Name',
  deleteTitle: 'Delete this conversation?',
  deleteText: (title, days) =>
    `“${title}” goes to the trash. It can be restored from Trash for ${days} days, then it is deleted for good.`,
  deleteManyTitle: (n) => `Delete ${n} conversations?`,
  deleteManyText: (days) =>
    `They go to the trash and can be restored from Trash for ${days} days, then they are deleted for good.`,
  foreverTitle: 'Delete forever?',
  foreverText: (title) => `“${title}” is deleted for good, with every line in it. This cannot be undone.`,
  foreverManyTitle: (n) => `Delete ${n} conversations forever?`,
  foreverManyText: 'They are deleted for good, with every line in them. This cannot be undone.',
  emptyTitle: 'Empty the trash?',
  emptyText: 'Every conversation in the trash is deleted for good. This cannot be undone.',
  emptyConfirm: 'Empty trash',
  delete: 'Delete',
  deleteForever: 'Delete forever',
  couldNotPin: 'It could not be pinned.',
  couldNotRestore: 'It could not be restored.',
  couldNotExport: 'It could not be exported.',
};

const tr: WorkspaceStrings = {
  movedToTrash: 'Çöp’e taşındı',
  renamed: 'Adı değişti',
  pinned: 'Sabitlendi',
  restored: (title) => `“${title}” geri geldi`,
  exported: (name) => `Chat/Exports’a aktarıldı: ${name}`,
  keptBack: (n) => `${n} tanesi korundu: yalnızca yazanı ya da silme yetkisi olan kaldırabilir.`,
  bulk: (what, n, failed) => {
    const done = trVariants(what, n);
    if (!failed) return { text: done, bad: false };
    const stayed = failed === 1 ? 'bir sohbet' : `${failed} sohbet`;
    if (!n) return { text: `Hiçbir şey değişmedi: ${stayed} ulaşılamadı.`, bad: true };
    return { text: `${done}; ${stayed} ulaşılamadı ve yerinde kaldı.`, bad: true };
  },
  rename: 'Adını değiştir',
  save: 'Kaydet',
  name: 'Ad',
  deleteTitle: 'Bu sohbet silinsin mi?',
  deleteText: (title, days) =>
    `“${title}” çöpe gider. ${days} gün boyunca Çöp’ten geri getirilebilir, sonra kalıcı olarak silinir.`,
  deleteManyTitle: (n) => `${n} sohbet silinsin mi?`,
  deleteManyText: (days) => `Çöpe giderler ve ${days} gün boyunca Çöp’ten geri getirilebilirler, sonra kalıcı olarak silinirler.`,
  foreverTitle: 'Kalıcı olarak silinsin mi?',
  foreverText: (title) => `“${title}” içindeki her satırla birlikte kalıcı olarak silinir. Bu geri alınamaz.`,
  foreverManyTitle: (n) => `${n} sohbet kalıcı olarak silinsin mi?`,
  foreverManyText: 'İçlerindeki her satırla birlikte kalıcı olarak silinirler. Bu geri alınamaz.',
  emptyTitle: 'Çöp kutusu boşaltılsın mı?',
  emptyText: 'Çöpteki her sohbet kalıcı olarak silinir. Bu geri alınamaz.',
  emptyConfirm: 'Çöpü boşalt',
  delete: 'Sil',
  deleteForever: 'Kalıcı olarak sil',
  couldNotPin: 'Sabitlenemedi.',
  couldNotRestore: 'Geri getirilemedi.',
  couldNotExport: 'Dışa aktarılamadı.',
};

export function workspaceStrings(lang: UiLang): WorkspaceStrings {
  return lang === 'tr' ? tr : en;
}
