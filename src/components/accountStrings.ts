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
  /** The account that is open now, in a word: "Active". */
  current: string;
  removeLabel: (who: string) => string;
  removeTitle: (who: string) => string;
  removeText: string;
  remove: string;
  /** Signing the open account out: the one that keeps everything it had open. */
  signOutTitle: string;
  signOutText: string;
  /** The same, naming the account: "Sign out of Ada Demir". */
  signOutOf: (who: string) => string;
  signOutTitleOf: (who: string) => string;
  sessionEnded: string;
  // Before signing in: choosing the server and the way in
  serverSub: string;
  serverAddress: string;
  connect: string;
  connectTo: (server: string) => string;
  recentServers: string;
  forgetServer: string;
  forgetServerLabel: (server: string) => string;
  addressUnusable: string;
  notWorkbenchServer: string;
  httpsHint: string;
  signInSub: string;
  email: string;
  password: string;
  signIn: string;
  change: string;
  enterEmailPassword: string;
  mustChoosePassword: string;
  signInFailed: string;
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
  current: 'Active',
  removeLabel: (who) => `Sign out of ${who}`,
  removeTitle: (who) => `Sign out of ${who}?`,
  removeText: 'Only this account is signed out and taken off this phone; the others stay signed in.',
  remove: 'Sign out',
  signOutTitle: 'Sign out of Workbench?',
  signOutText:
    'The conversation you have open stays on this phone, and a draft stays in the box. You need your password to come back.',
  signOutOf: (who) => `Sign out of ${who}`,
  signOutTitleOf: (who) => `Sign out of ${who}?`,
  sessionEnded: 'Signed out',
  serverSub: 'Connect to a Workbench server: the address you open the web app at.',
  serverAddress: 'Server address',
  connect: 'Connect',
  connectTo: (server) => `Connect to ${server}`,
  recentServers: 'Recent servers',
  forgetServer: 'Remove',
  forgetServerLabel: (server) => `Remove ${server} from recent servers`,
  addressUnusable: 'That address cannot be used.',
  notWorkbenchServer: 'It did not answer as a Workbench server.',
  httpsHint: 'https is used unless you type http://.',
  signInSub: 'Sign in to continue.',
  email: 'Email',
  password: 'Password',
  signIn: 'Sign in',
  change: 'Change',
  enterEmailPassword: 'Enter your email address and password.',
  mustChoosePassword:
    'This account must choose a new password first. Do that in the web app, then sign in here.',
  signInFailed: 'Signing in failed.',
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
  current: 'Aktif',
  removeLabel: (who) => `${who} hesabından çıkış yap`,
  removeTitle: (who) => `${who} hesabından çıkılsın mı?`,
  removeText: 'Yalnızca bu hesaptan çıkılır ve bu telefondan kaldırılır; diğerleri oturum açık kalır.',
  remove: 'Çıkış yap',
  signOutTitle: 'Workbench\u2019ten çıkılsın mı?',
  signOutText:
    'Açık konuşma bu telefonda kalır, yazdığın taslak kutuda durur. Geri dönmek için şifren gerekir.',
  signOutOf: (who) => `${who} hesabından çık`,
  signOutTitleOf: (who) => `${who} hesabından çıkılsın mı?`,
  sessionEnded: 'Oturum kapalı',
  serverSub: 'Bir Workbench sunucusuna bağlanın: web uygulamasını açtığınız adres.',
  serverAddress: 'Sunucu adresi',
  connect: 'Bağlan',
  connectTo: (server) => `${server} sunucusuna bağlan`,
  recentServers: 'Son sunucular',
  forgetServer: 'Kaldır',
  forgetServerLabel: (server) => `${server} son sunuculardan kaldırılsın`,
  addressUnusable: 'Bu adres kullanılamıyor.',
  notWorkbenchServer: 'Bir Workbench sunucusu gibi yanıt vermedi.',
  httpsHint: 'http:// yazmazsanız https kullanılır.',
  signInSub: 'Devam etmek için giriş yapın.',
  email: 'E-posta',
  password: 'Parola',
  signIn: 'Giriş yap',
  change: 'Değiştir',
  enterEmailPassword: 'E-posta adresinizi ve parolanızı girin.',
  mustChoosePassword:
    'Bu hesabın önce yeni bir parola seçmesi gerekiyor. Bunu web uygulamasında yapın, sonra buradan giriş yapın.',
  signInFailed: 'Giriş yapılamadı.',
  options: { auto: 'Otomatik', live: 'Konuşurken', record: 'Kayıt bitince' },
};

export function accountStrings(lang: UiLang): AccountStrings {
  return lang === 'tr' ? tr : en;
}

/** The choices with their labels in that language. */
export function localized<T extends { id: string; label: string }>(opts: T[], t: AccountStrings): T[] {
  return opts.map((o) => ({ ...o, label: t.options[o.id] ?? o.label }));
}
