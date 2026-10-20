/**
 * What Account says, in English and Turkish: the same language as the
 * update's (src/update/strings.ts uiLang), so the whole sheet reads alike.
 */
import type { UiLang } from '../update/strings';

export interface AccountStrings {
  localMode: string;
  server: string;
  voiceLanguage: string;
  wordsAppear: string;
  changeServer: string;
  signOut: string;
  accounts: string;
  addAccount: string;
  cancel: string;
  /** A row of another account: switch to it. */
  switchHint: string;
  current: string;
  removeLabel: (who: string) => string;
  removeTitle: (who: string) => string;
  removeText: string;
  remove: string;
  sessionEnded: string;
  /** The voice choices' labels, by id (Türkçe and English stay as they are). */
  options: Record<string, string>;
}

const en: AccountStrings = {
  localMode: 'Local mode',
  server: 'Server',
  voiceLanguage: 'Voice language',
  wordsAppear: 'Words appear',
  changeServer: 'Change server',
  signOut: 'Sign out',
  accounts: 'Accounts',
  addAccount: 'Add account',
  cancel: 'Cancel',
  switchHint: 'Switch to this account',
  current: 'Open now',
  removeLabel: (who) => `Sign out of ${who}`,
  removeTitle: (who) => `Sign out of ${who}?`,
  removeText: 'Only this account is signed out and taken off this phone; the others stay signed in.',
  remove: 'Sign out',
  sessionEnded: 'Signed out',
  options: {},
};

const tr: AccountStrings = {
  localMode: 'Yerel mod',
  server: 'Sunucu',
  voiceLanguage: 'Konuşma dili',
  wordsAppear: 'Yazıya dökme',
  changeServer: 'Sunucuyu değiştir',
  signOut: 'Çıkış yap',
  accounts: 'Hesaplar',
  addAccount: 'Hesap ekle',
  cancel: 'Vazgeç',
  switchHint: 'Bu hesaba geç',
  current: 'Şu an açık',
  removeLabel: (who) => `${who} hesabından çıkış yap`,
  removeTitle: (who) => `${who} hesabından çıkılsın mı?`,
  removeText: 'Yalnızca bu hesaptan çıkılır ve bu telefondan kaldırılır; diğerleri oturum açık kalır.',
  remove: 'Çıkış yap',
  sessionEnded: 'Oturum kapalı',
  options: { auto: 'Otomatik', live: 'Konuşurken', record: 'Kayıt bitince' },
};

export function accountStrings(lang: UiLang): AccountStrings {
  return lang === 'tr' ? tr : en;
}

/** The choices with their labels in that language. */
export function localized<T extends { id: string; label: string }>(opts: T[], t: AccountStrings): T[] {
  return opts.map((o) => ({ ...o, label: t.options[o.id] ?? o.label }));
}
