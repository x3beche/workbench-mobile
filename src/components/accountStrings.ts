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
  options: {},
};

const tr: AccountStrings = {
  localMode: 'Yerel mod',
  server: 'Sunucu',
  voiceLanguage: 'Konuşma dili',
  wordsAppear: 'Yazıya dökme',
  changeServer: 'Sunucuyu değiştir',
  signOut: 'Çıkış yap',
  options: { auto: 'Otomatik', live: 'Konuşurken', record: 'Kayıt bitince' },
};

export function accountStrings(lang: UiLang): AccountStrings {
  return lang === 'tr' ? tr : en;
}

/** The choices with their labels in that language. */
export function localized<T extends { id: string; label: string }>(opts: T[], t: AccountStrings): T[] {
  return opts.map((o) => ({ ...o, label: t.options[o.id] ?? o.label }));
}
