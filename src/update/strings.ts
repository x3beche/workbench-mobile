/**
 * What the update says, in English and Turkish. The language follows the
 * one chosen for voice in Account (as the example questions do); with Auto,
 * the phone's own language.
 */
import type { VoiceLang } from '../api/client';

export type UiLang = 'en' | 'tr';

/** The app's language as chosen in Settings > Language: English, Türkçe, or Auto (null). */
let chosen: UiLang | null = null;

/** Settings > Language: the app's words in English or Turkish, whatever the voice; null for Auto. */
export function setAppLanguage(lang: UiLang | null): void {
  chosen = lang;
}

/**
 * The language the app speaks: the one chosen in Settings > Language; with
 * Auto, the voice language's (as before), and with that on Auto too, the
 * phone's - Turkish when it is set to Turkish, else English.
 */
export function uiLang(lang: VoiceLang, locale: string | undefined = deviceLocale()): UiLang {
  if (chosen) return chosen;
  if (lang === 'tr' || lang === 'en') return lang;
  return locale && /^tr\b/i.test(locale) ? 'tr' : 'en';
}

function deviceLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export interface UpdateStrings {
  section: string;
  /** The value line: the version on this phone, or the one the server has. */
  version: (v: string) => string;
  ready: (v: string) => string;
  /** Under "Version 1.5.1 is ready": the one installed now. */
  youHave: (v: string) => string;
  upToDate: string;
  whatsNew: string;
  check: string;
  checking: string;
  none: string;
  checkFailed: (why: string) => string;
  offline: string;
  downloadInstall: string;
  downloading: (got: string, total: string) => string;
  downloadingNoTotal: (got: string) => string;
  cancel: string;
  verifying: string;
  installing: string;
  notInstalled: string;
  install: string;
  permission: string;
  openSetting: string;
  tryAgain: string;
  webOnly: string;
  /** Under the name in the drawer. */
  drawer: (v: string) => string;
  errors: Record<'network' | 'cancelled' | 'size' | 'hash' | 'storage' | 'install', string>;
  http: (status: number) => string;
}

const en: UpdateStrings = {
  section: 'App',
  version: (v) => `Version ${v}`,
  ready: (v) => `Version ${v} is ready`,
  youHave: (v) => `You have ${v}`,
  upToDate: 'Up to date',
  whatsNew: "What's new",
  check: 'Check',
  checking: 'Checking…',
  none: 'This server has no app download',
  checkFailed: (why) => `Couldn't check: ${why}`,
  offline: "Can't reach the server",
  downloadInstall: 'Download and install',
  downloading: (got, total) => `Downloading ${got} of ${total}`,
  downloadingNoTotal: (got) => `Downloading ${got}`,
  cancel: 'Cancel',
  verifying: 'Verifying the download…',
  installing: 'Opening the installer…',
  notInstalled: 'Not installed yet.',
  install: 'Install',
  permission: 'Android needs your permission first. Turn on "Allow from this source", then come back here.',
  openSetting: 'Open settings',
  tryAgain: 'Try again',
  webOnly: 'Install updates from the Android app.',
  drawer: (v) => `Update ready: ${v}`,
  errors: {
    network: "The download stopped. Check the connection and try again.",
    cancelled: 'Download cancelled.',
    size: 'The download is incomplete. Try again.',
    hash: "The download didn't pass the check, so it was deleted. Try again.",
    storage: 'Not enough space on the phone.',
    install: "Couldn't open the installer.",
  },
  http: (n) => `The server refused the download (HTTP ${n}).`,
};

const tr: UpdateStrings = {
  section: 'Uygulama',
  version: (v) => `Sürüm ${v}`,
  ready: (v) => `Sürüm ${v} hazır`,
  youHave: (v) => `Yüklü olan ${v}`,
  upToDate: 'Güncel',
  whatsNew: 'Yenilikler',
  check: 'Denetle',
  checking: 'Denetleniyor…',
  none: 'Bu sunucuda uygulama indirmesi yok',
  checkFailed: (why) => `Denetlenemedi: ${why}`,
  offline: 'Sunucuya ulaşılamıyor',
  downloadInstall: 'İndir ve yükle',
  downloading: (got, total) => `İndiriliyor: ${got} / ${total}`,
  downloadingNoTotal: (got) => `İndiriliyor: ${got}`,
  cancel: 'İptal',
  verifying: 'Dosya doğrulanıyor…',
  installing: 'Yükleyici açılıyor…',
  notInstalled: 'Henüz yüklenmedi.',
  install: 'Yükle',
  permission: 'Önce Android’in izin vermesi gerekiyor. "Bu kaynaktan izin ver"i açıp buraya dönün.',
  openSetting: 'Ayarları aç',
  tryAgain: 'Yeniden dene',
  webOnly: 'Güncellemeyi Android uygulamasından yükleyin.',
  drawer: (v) => `Güncelleme hazır: ${v}`,
  errors: {
    network: 'İndirme yarıda kaldı. Bağlantıyı kontrol edip yeniden deneyin.',
    cancelled: 'İndirme iptal edildi.',
    size: 'İndirme eksik kaldı. Yeniden deneyin.',
    hash: 'İndirilen dosya doğrulanamadı ve silindi. Yeniden deneyin.',
    storage: 'Telefonda yeterli yer yok.',
    install: 'Yükleyici açılamadı.',
  },
  http: (n) => `Sunucu indirmeyi reddetti (HTTP ${n}).`,
};

export function updateStrings(lang: UiLang): UpdateStrings {
  return lang === 'tr' ? tr : en;
}
