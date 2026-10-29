/**
 * What Settings > Claude pool says (screens/CcpoolScreen.tsx, lib/ccpool.ts),
 * in English and Turkish: the web app's own words
 * (frontend/src/app/ccpool-settings.ts) and its Turkish from i18n.ts.
 */
import type { UiLang } from '../update/strings';

export interface CcpoolStrings {
  title: string;
  about: string;
  subscription: string;
  sharedPlan: string;
  fiveHour: string;
  sevenDay: string;
  sevenDayOf: (x: string) => string;
  startsAgain: (x: string, y: string) => string;
  startsNow: string;
  lastKnown: string;
  planWeek: string;
  used: string;
  noFigure: string;
  outside: string;
  unused: string;
  notAssigned: string;
  thisWeek: string;
  thisWeekRange: (x: string) => string;
  now: string;
  account: string;
  requests: string;
  tokens: string;
  apiValue: string;
  plan5: string;
  lastUse: string;
  never: string;
  you: string;
  manual: string;
  allAccounts: string;
  mySessions: string;
  name: string;
  status: string;
  computer: string;
  lastActivity: string;
  promptsCalls: string;
  state: Record<'active' | 'idle' | 'ended', string>;
  sessions: (n: number) => string;
  activeNow: (n: number) => string;
  removed: (n: number) => string;
  outsideSessions: (x: string) => string;
  byHand: (x: string) => string;
  noSessions: string;
  noKey: string;
  unreadable: string;
  justNow: string;
  minAgo: (n: number) => string;
  hAgo: (n: number) => string;
  dAgo: (n: number) => string;
  units: { s: string; min: string; h: string; d: string };
  refresh: string;
  /** The way back out, said by the arrow: not the title again. */
  back: string;
  /** The row in Settings under the section of the same name: what it shows, not its name again. */
  usage: string;
}

const en: CcpoolStrings = {
  title: 'Claude pool',
  back: 'Back',
  usage: 'Usage',
  about: "who may use this server's Claude account",
  subscription: 'Subscription usage',
  sharedPlan: "the server's Claude plan, shared by every key",
  fiveHour: '5-hour window',
  sevenDay: '7-day window',
  sevenDayOf: (x) => `7-day ${x}`,
  startsAgain: (x, y) => `Starts again from 0 in ${x}, at ${y}`,
  startsNow: 'starts again now',
  lastKnown: 'last known figure',
  planWeek: 'Plan this week',
  used: 'used',
  noFigure: 'No figure from the subscription yet.',
  outside: 'Outside the pool',
  unused: 'Unused',
  notAssigned: 'Not assigned',
  thisWeek: 'This week',
  thisWeekRange: (x) => `this week: ${x}`,
  now: 'now',
  account: 'Account',
  requests: 'Requests',
  tokens: 'Tokens',
  apiValue: 'API value',
  plan5: 'Plan, 5 hours',
  lastUse: 'Last use',
  never: 'never',
  you: 'you',
  manual: 'manual',
  allAccounts: 'All accounts',
  mySessions: 'My sessions',
  name: 'Name',
  status: 'Status',
  computer: 'Computer',
  lastActivity: 'Last activity',
  promptsCalls: 'Prompts / calls',
  state: { active: 'active', idle: 'idle', ended: 'ended' },
  sessions: (n) => (n === 1 ? '1 session' : `${n} sessions`),
  activeNow: (n) => `${n} active now`,
  removed: (n) => `${n} removed`,
  outsideSessions: (x) => `${x} outside sessions`,
  byHand: (x) => `${x} added by hand`,
  noSessions: 'None of your Claude Code sessions has run through the pool yet.',
  noKey: 'No key yet - ask the owner for one.',
  unreadable: 'the Claude pool could not be read',
  justNow: 'just now',
  minAgo: (n) => `${n} min ago`,
  hAgo: (n) => `${n} h ago`,
  dAgo: (n) => `${n} d ago`,
  units: { s: 's', min: 'min', h: 'h', d: 'd' },
  refresh: 'Refresh',
};

const tr: CcpoolStrings = {
  back: 'Geri',
  usage: 'Kullanım',
  title: 'Claude havuzu',
  about: 'bu sunucunun Claude hesabını kimler kullanabilir',
  subscription: 'Abonelik kullanımı',
  sharedPlan: 'sunucunun Claude planı, bütün anahtarlar ortak kullanır',
  fiveHour: '5 saatlik pencere',
  sevenDay: '7 günlük pencere',
  sevenDayOf: (x) => `7 günlük ${x}`,
  startsAgain: (x, y) => `${x} sonra sıfırlanır (${y})`,
  startsNow: 'şimdi sıfırlanıyor',
  lastKnown: 'bilinen son değer',
  planWeek: 'Bu hafta plan',
  used: 'kullanılan',
  noFigure: 'Abonelikten henüz rakam gelmedi.',
  outside: 'Havuz dışı',
  unused: 'Kullanılmayan',
  notAssigned: 'Atanmamış',
  thisWeek: 'Bu hafta',
  thisWeekRange: (x) => `bu hafta: ${x}`,
  now: 'şimdi',
  account: 'Hesap',
  requests: 'İstekler',
  tokens: 'Token',
  apiValue: 'API değeri',
  plan5: 'Plan, 5 saat',
  lastUse: 'Son kullanım',
  never: 'hiç',
  you: 'siz',
  manual: 'elle',
  allAccounts: 'Bütün hesaplar',
  mySessions: 'Oturumlarım',
  name: 'Ad',
  status: 'Durum',
  computer: 'Bilgisayar',
  lastActivity: 'Son etkinlik',
  promptsCalls: 'Prompt / çağrı',
  state: { active: 'etkin', idle: 'boşta', ended: 'bitti' },
  sessions: (n) => (n === 1 ? '1 oturum' : `${n} oturum`),
  activeNow: (n) => `şu an ${n} etkin`,
  removed: (n) => `${n} kaldırıldı`,
  outsideSessions: (x) => `oturum dışında ${x}`,
  byHand: (x) => `${x} elle eklendi`,
  noSessions: 'Henüz havuzdan geçen bir Claude Code oturumun yok.',
  noKey: 'Henüz anahtarın yok - sahibinden iste.',
  unreadable: 'Claude havuzu okunamadı',
  justNow: 'az önce',
  minAgo: (n) => `${n} dk önce`,
  hAgo: (n) => `${n} sa önce`,
  dAgo: (n) => `${n} gün önce`,
  units: { s: 'sn', min: 'dk', h: 'sa', d: 'g' },
  refresh: 'Yenile',
};

export function ccpoolStrings(lang: UiLang): CcpoolStrings {
  return lang === 'tr' ? tr : en;
}
