/**
 * What the drawer says, in English and Turkish: the scope tabs, the search,
 * the groups a conversation falls in, the bulk bar, the room rows and the
 * hints a screen reader reads out. The Turkish is the web app's own where it
 * has the same words (frontend/src/app/i18n.ts).
 */
import type { GroupName } from './groups';
import type { UiLang } from '../update/strings';

export interface DrawerStrings {
  conversations: string;
  archived: string;
  trash: string;
  rooms: string;
  results: string;
  deletedFirst: string;
  groups: Record<GroupName, string>;
  search: string;
  searchChats: string;
  clearSearch: string;
  searching: string;
  reading: string;
  nothingFound: (q: string) => string;
  newChat: string;
  select: string;
  done: string;
  selectSeveral: string;
  doneSelecting: string;
  tickAll: string;
  untickAll: string;
  bulkArchive: string;
  bulkUnarchive: string;
  bulkRestore: string;
  bulkDelete: string;
  bulkForever: string;
  keptDays: (n: number) => string;
  emptyTrash: string;
  tryAgain: string;
  files: string;
  analytics: string;
  account: (who: string, update: string | null) => string;
  localMode: string;
  /** The badge on a room with lines not read here: "1 new", "3 new". */
  newLines: (n: number) => string;
  /** The same, for a screen reader: "One line not read", "3 lines not read". */
  unread: (n: number) => string;
  roomHint: string;
  questionWaits: string;
  unreadSomeone: string;
  foldsRooms: string;
  opensRooms: string;
  actionsFor: (title: string) => string;
  rowHintChat: string;
  rowHintTrash: string;
  rowHintTick: string;
  dLeft: (n: number) => string;
  emptyLive: string;
  emptyArchived: string;
  emptyNothing: string;
  emptyTrashDays: (n: number) => string;
}

const en: DrawerStrings = {
  conversations: 'Conversations',
  archived: 'Archived',
  trash: 'Trash',
  rooms: 'Rooms',
  results: 'Results',
  deletedFirst: 'Deleted, newest first',
  groups: {
    Pinned: 'Pinned',
    Today: 'Today',
    Yesterday: 'Yesterday',
    'Previous 7 days': 'Previous 7 days',
    Older: 'Older',
  },
  search: 'Search',
  searchChats: 'Search the conversations',
  clearSearch: 'Clear the search',
  searching: 'Searching',
  reading: 'Reading the conversations',
  nothingFound: (q) => `Nothing found for “${q}”.`,
  newChat: 'New chat',
  select: 'Select',
  done: 'Done',
  selectSeveral: 'Select several conversations',
  doneSelecting: 'Done selecting',
  tickAll: 'Tick every conversation',
  untickAll: 'Untick every conversation',
  bulkArchive: 'Archive',
  bulkUnarchive: 'Unarchive',
  bulkRestore: 'Restore',
  bulkDelete: 'Delete',
  bulkForever: 'Delete forever',
  keptDays: (n) => `Kept ${n} days, then deleted for good.`,
  emptyTrash: 'Empty trash',
  tryAgain: 'Try again',
  files: 'Files',
  analytics: 'Analytics',
  account: (who, update) => `Account: ${who}${update ? `. ${update}` : ''}`,
  localMode: 'Local mode',
  newLines: (n) => `${n > 99 ? '99+' : n} new`,
  unread: (n) => (n === 1 ? 'One line not read' : `${n} lines not read`),
  roomHint: "The agent's own thread for this room",
  questionWaits: 'A question waits for an answer',
  unreadSomeone: 'unread',
  foldsRooms: 'Folds the rooms',
  opensRooms: 'Opens the rooms',
  actionsFor: (title) => `Actions for ${title}`,
  rowHintChat: 'Archive, delete and more: its … at the end of the row',
  rowHintTrash: 'Restore or delete forever',
  rowHintTick: 'Ticks it, for the buttons above',
  dLeft: (n) => `${n} d left`,
  emptyLive: 'No conversations yet. Conversations started on the web show here too.',
  emptyArchived: 'Nothing archived. A swipe to the left on a conversation archives it.',
  emptyNothing: 'Nothing in the trash.',
  emptyTrashDays: (n) => `The trash is empty. Deleted conversations stay here ${n} days.`,
};

const tr: DrawerStrings = {
  conversations: 'Sohbetler',
  archived: 'Arşiv',
  trash: 'Çöp',
  rooms: 'Odalar',
  results: 'Sonuçlar',
  deletedFirst: 'Silinenler, yenisi önce',
  groups: {
    Pinned: 'Sabitlenen',
    Today: 'Bugün',
    Yesterday: 'Dün',
    'Previous 7 days': 'Son 7 gün',
    Older: 'Daha eski',
  },
  search: 'Ara',
  searchChats: 'Sohbetlerde ara',
  clearSearch: 'Aramayı temizle',
  searching: 'Aranıyor',
  reading: 'Sohbetler okunuyor',
  nothingFound: (q) => `“${q}” için bir şey bulunamadı.`,
  newChat: 'Yeni sohbet',
  select: 'Seç',
  done: 'Bitti',
  selectSeveral: 'Birkaç sohbet seç',
  doneSelecting: 'Seçimi bitir',
  tickAll: 'Bütün sohbetleri işaretle',
  untickAll: 'Bütün işaretleri kaldır',
  bulkArchive: 'Arşivle',
  bulkUnarchive: 'Arşivden çıkar',
  bulkRestore: 'Geri getir',
  bulkDelete: 'Sil',
  bulkForever: 'Kalıcı olarak sil',
  keptDays: (n) => `${n} gün saklanır, sonra kalıcı olarak silinir.`,
  emptyTrash: 'Çöpü boşalt',
  tryAgain: 'Yeniden dene',
  files: 'Dosyalar',
  analytics: 'Analitik',
  account: (who, update) => `Hesap: ${who}${update ? `. ${update}` : ''}`,
  localMode: 'Yerel mod',
  newLines: (n) => `${n > 99 ? '99+' : n} yeni`,
  unread: (n) => (n === 1 ? 'Bir satır okunmadı' : `${n} satır okunmadı`),
  roomHint: 'Bu odanın ajanının kendi sohbeti',
  questionWaits: 'Bir soru yanıt bekliyor',
  unreadSomeone: 'okunmadı',
  foldsRooms: 'Odaları toplar',
  opensRooms: 'Odaları açar',
  actionsFor: (title) => `${title} için işlemler`,
  rowHintChat: 'Arşivle, sil ve daha fazlası: satırın sonundaki …',
  rowHintTrash: 'Geri getir ya da kalıcı olarak sil',
  rowHintTick: 'İşaretler, yukarıdaki düğmeler için',
  dLeft: (n) => `${n} gün kaldı`,
  emptyLive: 'Henüz sohbet yok. Webde başlatılan sohbetler de burada görünür.',
  emptyArchived: 'Arşivde bir şey yok. Bir sohbeti sola kaydırmak onu arşivler.',
  emptyNothing: 'Çöp kutusu boş.',
  emptyTrashDays: (n) => `Çöp kutusu boş. Silinen sohbetler burada ${n} gün kalır.`,
};

export function drawerStrings(lang: UiLang): DrawerStrings {
  return lang === 'tr' ? tr : en;
}
