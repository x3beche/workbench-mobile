/**
 * What the update says, in English and Turkish. The language follows the
 * one chosen for voice in Account (as the example questions do); with Auto,
 * the phone's own language.
 */
import type { VoiceLang } from '../api/client';

export type UiLang = 'en' | 'tr';

/** Auto follows the phone: Turkish when it is set to Turkish, else English. */
export function uiLang(lang: VoiceLang, locale: string | undefined = deviceLocale()): UiLang {
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
  upToDate: (v: string) => string;
  installedOnly: (v: string) => string;
  available: string;
  fromTo: (from: string, to: string) => string;
  whatsNew: string;
  check: string;
  checking: string;
  none: (v: string) => string;
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
  drawer: (from: string, to: string) => string;
  errors: Record<'network' | 'cancelled' | 'size' | 'hash' | 'storage' | 'install', string>;
  http: (status: number) => string;
}

const en: UpdateStrings = {
  section: 'App',
  upToDate: (v) => `Installed ${v} — up to date`,
  installedOnly: (v) => `Installed ${v}`,
  available: 'Update available',
  fromTo: (a, b) => `Installed ${a} → New ${b}`,
  whatsNew: "What's new",
  check: 'Check for updates',
  checking: 'Checking for updates…',
  none: (v) => `Installed ${v} — this server offers no app download`,
  checkFailed: (why) => `Could not check for updates: ${why}`,
  offline: 'the server could not be reached.',
  downloadInstall: 'Download and install',
  downloading: (got, total) => `Downloading ${got} of ${total}`,
  downloadingNoTotal: (got) => `Downloading ${got}`,
  cancel: 'Cancel',
  verifying: 'Checking the download…',
  installing: 'Opening the installer…',
  notInstalled: 'The update was not installed.',
  install: 'Install',
  permission:
    'Android has to allow Workbench to install apps. Turn on "Allow from this source" in the setting, then come back here.',
  openSetting: 'Open the setting',
  tryAgain: 'Try again',
  webOnly: 'Updates install in the Android app.',
  drawer: (a, b) => `Update ${a} → ${b}`,
  errors: {
    network: 'The download stopped: the server could not be reached. Try again when the phone is online.',
    cancelled: 'Download cancelled.',
    size: 'The download is incomplete: its size does not match what the server says. Try again.',
    hash: 'The download does not match the server’s checksum, so it was deleted. Try again.',
    storage: 'There is not enough room on the phone for the download.',
    install: 'The installer could not be opened.',
  },
  http: (n) => `The server refused the download (HTTP ${n}).`,
};

const tr: UpdateStrings = {
  section: 'Uygulama',
  upToDate: (v) => `Yüklü ${v} — güncel`,
  installedOnly: (v) => `Yüklü ${v}`,
  available: 'Güncelleme var',
  fromTo: (a, b) => `Yüklü ${a} → Yeni ${b}`,
  whatsNew: 'Yenilikler',
  check: 'Güncellemeleri denetle',
  checking: 'Güncellemeler denetleniyor…',
  none: (v) => `Yüklü ${v} — bu sunucuda uygulama indirmesi yok`,
  checkFailed: (why) => `Güncellemeler denetlenemedi: ${why}`,
  offline: 'sunucuya ulaşılamadı.',
  downloadInstall: 'İndir ve yükle',
  downloading: (got, total) => `İndiriliyor: ${got} / ${total}`,
  downloadingNoTotal: (got) => `İndiriliyor: ${got}`,
  cancel: 'İptal',
  verifying: 'İndirilen dosya doğrulanıyor…',
  installing: 'Yükleyici açılıyor…',
  notInstalled: 'Güncelleme yüklenmedi.',
  install: 'Yükle',
  permission:
    'Android’in Workbench’e uygulama yükleme izni vermesi gerekiyor. Ayarda "Bu kaynaktan izin ver"i açın, sonra buraya dönün.',
  openSetting: 'Ayarı aç',
  tryAgain: 'Yeniden dene',
  webOnly: 'Güncellemeler Android uygulamasında yüklenir.',
  drawer: (a, b) => `Güncelleme ${a} → ${b}`,
  errors: {
    network: 'İndirme durdu: sunucuya ulaşılamadı. Telefon çevrimiçi olunca yeniden deneyin.',
    cancelled: 'İndirme iptal edildi.',
    size: 'İndirme eksik: boyutu sunucunun söylediğiyle tutmuyor. Yeniden deneyin.',
    hash: 'İndirilen dosya sunucunun sağlama toplamıyla eşleşmedi, silindi. Yeniden deneyin.',
    storage: 'Telefonda indirme için yeterli yer yok.',
    install: 'Yükleyici açılamadı.',
  },
  http: (n) => `Sunucu indirmeyi reddetti (HTTP ${n}).`,
};

export function updateStrings(lang: UiLang): UpdateStrings {
  return lang === 'tr' ? tr : en;
}
