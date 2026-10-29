/**
 * What Settings and Analytics say, in English and Turkish (the app's
 * language: Settings > Language, update/strings.ts uiLang). The Turkish is
 * the web app's own where it has the same words.
 */
import type { UiLang } from '../update/strings';

export interface SettingsStrings {
  settings: string;
  analytics: string;
  language: string;
  languageAbout: string;
  auto: string;
  theme: string;
  themeAbout: string;
  followPhone: string;
  dark: string;
  light: string;
  restartTitle: (name: string) => string;
  restartText: string;
  restart: string;
  voice: string;
  app: string;
  about: string;
  aboutText: string;
  licence: string;
  source: string;
  // Settings' menu (1.9.9)
  /** The way back from a page under Settings. */
  back: string;
  menuGroups: { account: string; ai: string; appearance: string; voice: string; app: string };
  accountsAbout: string;
  /** Under Add account, and the line under the accounts of this phone. */
  accountsAddAbout: string;
  accountsNote: string;
  voiceLangAbout: string;
  voiceModeAbout: string;
  /** The one line a menu row carries; the page under it says the rest. */
  rowSub: { theme: string; language: string; chat: string; pool: string };
  /** What each choice means, under its name on the page that offers it. */
  languageChoice: { auto: string; en: string; tr: string };
  voiceLangChoice: { auto: string; en: string; tr: string };
  voiceModeChoice: { live: string; record: string };
  version: string;
  versionAbout: string;
  widget: string;
  widgetAbout: string;
  widgetNone: string;
  widgetAdded: string;
  widgetAdd: string;
  widgetWhat: string;
  widgetHow: string;
  widgetOnlyAndroid: string;
  signOutAbout: string;
  aboutSub: string;
  // Analytics
  models: string;
  modelsAbout: string;
  thisMonth: string;
  today: string;
  tokens: string;
  calls: string;
  answers: string;
  speed: (tps: string, ttft: string) => string;
  spend: string;
  spendAbout: string;
  perDay: string;
  byProvider: string;
  byModel: string;
  byJob: string;
  unpriced: (n: number) => string;
  tools: string;
  toolsAbout: string;
  uses: (n: number) => string;
  /** How many different tools were used this week - "33 tools". */
  toolCount: (n: number) => string;
  /** The word alone, for a figure drawn beside its number: "tools". */
  toolWord: (n: number) => string;
  worked: (n: number) => string;
  /** The week's most used tool, of any source. */
  mostUsed: string;
  /** The person's own Claude Code and OpenCode tool calls (Tools group). */
  claudeTools: string;
  opencodeTools: string;
  orchestrator: string;
  orchestratorAbout: string;
  agentsNow: (n: number) => string;
  incidents: string;
  noIncidents: string;
  pool: string;
  poolAbout: string;
  yourJobs: string;
  noJobs: string;
  serverLoad: (running: number, queued: number, limit: number) => string;
  recentJobs: string;
  waited: string;
  ran: string;
  sandboxes: string;
  sandboxesAbout: (running: number, max: number) => string;
  adminsOnly: string;
  nothing: string;
  cannotRead: string;
  /** Some figures could not be read now: the ones on screen are the last that were. */
  someMissed: string;
  refresh: string;
  /** Analytics' groups, above their cards. */
  groups: { llm: string; agents: string; work: string; tools: string; server: string };
  /** A card's period, at the right of its head. */
  period: { month: string; days30: string; week: string; now: string; latest: string };
  showAll: string;
  showLess: string;
  subAgents: (n: number) => string;
  waiting: (n: number) => string;
  running: string;
  memory: string;
  /** The live figures (the web top bar's Activity). */
  activity: string;
  /** Running and waiting jobs, and the agents at work. */
  jobsNow: (running: number, queued: number, agents: number) => string;
  machine: (cpu: number, mem: string) => string;
}

const en: SettingsStrings = {
  settings: 'Settings',
  analytics: 'Analytics',
  language: 'Language',
  languageAbout: 'The words of the app. Auto follows the voice language, then the phone.',
  auto: 'Auto',
  theme: 'Theme',
  themeAbout: "The web app's themes, colour for colour.",
  followPhone: 'Follow the phone',
  dark: 'dark',
  light: 'light',
  restartTitle: (name) => `Wear ${name}?`,
  restartText: 'The app starts again to wear it; you come back where you were signed in.',
  restart: 'Restart',
  voice: 'Voice',
  app: 'App',
  about: 'About',
  aboutText: 'Workbench mobile, the chat of any Workbench server.',
  licence: 'MIT licence',
  source: 'Source',
  back: 'Back',
  menuGroups: {
    account: 'Account',
    ai: 'Artificial intelligence',
    appearance: 'Appearance',
    voice: 'Voice',
    app: 'App',
  },
  accountsAbout: 'Who is signed in on this phone',
  rowSub: {
    theme: 'The web app’s, or the phone’s',
    language: 'The app’s words',
    chat: 'What an answer shows',
    pool: 'Who may use this account',
  },
  accountsAddAbout: 'Another server, or another person',
  accountsNote:
    'Signing one out takes only that account off this phone. The conversation you have open stays, and so does the draft in the box.',
  voiceLangAbout: 'What your voice is written in',
  voiceModeAbout: 'Live, or once the take is done',
  languageChoice: {
    auto: 'The voice language, then the phone’s',
    en: 'The app’s words in English',
    tr: 'The app’s words in Turkish',
  },
  voiceLangChoice: {
    auto: 'Whichever the phone speaks',
    en: 'English speech is written out',
    tr: 'Türkçe konuşma yazıya dökülür',
  },
  voiceModeChoice: {
    live: 'While you speak, where the server offers it',
    record: 'All at once, when the recording stops',
  },
  version: 'Version',
  versionAbout: 'The build on this phone',
  widget: 'Home screen widget',
  widgetAbout: 'The Chat tab’s two cards',
  widgetNone: 'Not added',
  widgetAdded: 'Added',
  widgetAdd: 'Add to the home screen',
  widgetWhat:
    'The Chat tab’s two cards on the home screen: this month’s models and this week’s tools, each with its last 14 days. It reads the figures the same way the app does, and redraws itself every thirty minutes.',
  widgetHow:
    'Touch and hold an empty place on the home screen, choose Widgets, then Workbench. The card takes five cells across and two down.',
  widgetOnlyAndroid: 'The home screen widget is Android’s. On this platform Settings only describes it.',
  signOutAbout: 'The conversations stay',
  aboutSub: 'Version, licence and source',
  models: 'Models',
  modelsAbout: 'Tokens a day, last 14 days, by provider',
  thisMonth: 'This month',
  today: 'Today',
  tokens: 'tokens',
  calls: 'calls',
  answers: 'answers',
  speed: (tps, ttft) => `median ${tps} tok/s, first token in ${ttft}`,
  spend: 'Spend and requests',
  spendAbout: 'Money a day, last 30 days',
  perDay: 'per day',
  byProvider: 'By provider',
  byModel: 'Requests by model',
  byJob: 'By job',
  unpriced: (n) => `${n} calls without a price`,
  tools: 'Tools',
  toolsAbout: 'Tool use this week, by day',
  uses: (n) => (n === 1 ? '1 use' : `${n} uses`),
  toolCount: (n) => `${n} ${n === 1 ? 'tool' : 'tools'}`,
  toolWord: (n) => (n === 1 ? 'tool' : 'tools'),
  worked: (n) => `${n} worked`,
  mostUsed: 'Most used',
  claudeTools: 'Your Claude Code tool calls, through the Claude pool',
  opencodeTools: 'Your OpenCode tool calls, from your computers',
  orchestrator: 'Orchestrator',
  orchestratorAbout: 'Your agent on the server',
  agentsNow: (n) => (n === 1 ? '1 sub-agent in its tree' : `${n} sub-agents in its tree`),
  incidents: 'Incidents',
  noIncidents: 'Nothing has gone wrong yet.',
  pool: 'Job pool',
  poolAbout: 'Builds, board steps and pictures waiting their turn',
  yourJobs: 'Your jobs',
  noJobs: 'Nothing of yours waits or runs.',
  serverLoad: (r, q, l) => `Server: ${r} running of ${l}, ${q} waiting`,
  recentJobs: 'Finished lately',
  waited: 'waited',
  ran: 'ran',
  sandboxes: 'Sandboxes',
  sandboxesAbout: (r, m) => `${r} running of ${m}`,
  adminsOnly: 'only the owner and the admins see this',
  nothing: 'Nothing yet.',
  cannotRead: 'This could not be read.',
  someMissed: 'Some figures could not be read just now: the ones shown are the last that were.',
  refresh: 'Refresh',
  groups: { llm: 'LLM', agents: 'Agents', work: 'Work', tools: 'Tools', server: 'Server' },
  period: { month: 'this month', days30: '30 days', week: 'this week', now: 'now', latest: 'latest' },
  showAll: 'Show all',
  showLess: 'Show less',
  subAgents: (n) => (n === 1 ? '1 sub-agent' : `${n} sub-agents`),
  waiting: (n) => `${n} waiting`,
  running: 'running',
  memory: 'memory',
  activity: 'Activity',
  jobsNow: (r, q, a) => `${r} running · ${q} waiting${a ? ` · ${a} ${a === 1 ? 'agent' : 'agents'}` : ''}`,
  machine: (c, m) => `CPU ${c}% · memory ${m}`,
};

const tr: SettingsStrings = {
  settings: 'Ayarlar',
  analytics: 'Analiz',
  language: 'Dil',
  languageAbout: 'Uygulamanın dili. Otomatik, konuşma dilini, o da otomatikse telefonu izler.',
  auto: 'Otomatik',
  theme: 'Tema',
  themeAbout: 'Web uygulamasının temaları, renk renk aynı.',
  followPhone: 'Telefonu izle',
  dark: 'koyu',
  light: 'açık',
  restartTitle: (name) => `${name} kullanılsın mı?`,
  restartText: 'Uygulama yeniden başlar; oturum açtığınız yere dönersiniz.',
  restart: 'Yeniden başlat',
  voice: 'Ses',
  app: 'Uygulama',
  about: 'Hakkında',
  aboutText: 'Workbench mobil, her Workbench sunucusunun sohbeti.',
  licence: 'MIT lisansı',
  source: 'Kaynak',
  back: 'Geri',
  menuGroups: {
    account: 'Hesap',
    ai: 'Yapay zeka',
    appearance: 'Görünüm',
    voice: 'Ses',
    app: 'Uygulama',
  },
  accountsAbout: 'Bu telefonda kim oturum açmış',
  rowSub: {
    theme: 'Web uygulamasının ya da telefonun',
    language: 'Uygulamanın sözleri',
    chat: 'Bir yanıtın gösterdikleri',
    pool: 'Bu hesabı kim kullanabilir',
  },
  accountsAddAbout: 'Başka sunucu, ya da aynı sunucuda başka biri',
  accountsNote:
    'Çıkış yalnızca o hesabı bu telefondan kaldırır. Açık konuşma ve kutudaki taslak yerinde kalır.',
  voiceLangAbout: 'Konuşmanız hangi dilde yazıya dökülür',
  voiceModeAbout: 'Konuşurken, ya da kayıttan sonra',
  languageChoice: {
    auto: 'Önce konuşma dili, o da otomatikse telefonunki',
    en: 'Uygulamanın sözleri İngilizce',
    tr: 'Uygulamanın sözleri Türkçe',
  },
  voiceLangChoice: {
    auto: 'Telefon hangi dili konuşuyorsa o',
    en: 'İngilizce konuşma yazıya dökülür',
    tr: 'Türkçe konuşma yazıya dökülür',
  },
  voiceModeChoice: {
    live: 'Sunucu sunuyorsa konuşurken',
    record: 'Kayıt bitince bir arada',
  },
  version: 'Sürüm',
  versionAbout: 'Bu telefondaki sürüm',
  widget: 'Ana ekran widget’ı',
  widgetAbout: 'Sohbet sekmesinin iki kartı',
  widgetNone: 'Eklenmedi',
  widgetAdded: 'Eklendi',
  widgetAdd: 'Ana ekrana ekle',
  widgetWhat:
    'Sohbet sekmesinin iki kartı ana ekranda: bu ayın modelleri ve bu haftanın araçları, her biri son 14 günüyle. Rakamları uygulamadaki gibi okur ve kendini otuz dakikada bir yeniden çizer.',
  widgetHow:
    'Ana ekranda boş bir yere basılı tutun, Widget’lar’ı seçin, sonra Workbench. Kart enine beş, boyuna iki hücre yer kaplar.',
  widgetOnlyAndroid: 'Ana ekran widget’ı Android’in. Bu platformda Ayarlar onu yalnızca anlatır.',
  signOutAbout: 'Konuşmalar telefonda kalır',
  aboutSub: 'Sürüm, lisans ve kaynak',
  models: 'Modeller',
  modelsAbout: 'Günlük token, son 14 gün, sağlayıcıya göre',
  thisMonth: 'Bu ay',
  today: 'Bugün',
  tokens: 'token',
  calls: 'çağrı',
  answers: 'yanıt',
  speed: (tps, ttft) => `ortanca ${tps} tok/sn, ilk token ${ttft}`,
  spend: 'Harcama ve istekler',
  spendAbout: 'Günlük harcama, son 30 gün',
  perDay: 'günlük',
  byProvider: 'Sağlayıcıya göre',
  byModel: 'Modele göre istekler',
  byJob: 'İşe göre',
  unpriced: (n) => `${n} çağrının fiyatı yok`,
  tools: 'Araçlar',
  toolsAbout: 'Bu haftaki araç kullanımı, güne göre',
  uses: (n) => `${n} kullanım`,
  toolCount: (n) => `${n} araç`,
  toolWord: () => 'araç',
  worked: (n) => `${n} başarılı`,
  mostUsed: 'En çok kullanılan',
  claudeTools: 'Claude Code araç çağrıların, Claude havuzu üzerinden',
  opencodeTools: 'OpenCode araç çağrıların, bilgisayarlarından',
  orchestrator: 'Orkestratör',
  orchestratorAbout: 'Sunucudaki ajanınız',
  agentsNow: (n) => `ağacında ${n} alt ajan`,
  incidents: 'Olaylar',
  noIncidents: 'Henüz bir sorun olmadı.',
  pool: 'İş kuyruğu',
  poolAbout: 'Sırasını bekleyen derlemeler, kart adımları ve görüntüler',
  yourJobs: 'İşleriniz',
  noJobs: 'Bekleyen ya da çalışan işiniz yok.',
  serverLoad: (r, q, l) => `Sunucu: ${l} yerin ${r} tanesi çalışıyor, ${q} bekliyor`,
  recentJobs: 'Son bitenler',
  waited: 'bekledi',
  ran: 'çalıştı',
  sandboxes: 'Sandbox’lar',
  sandboxesAbout: (r, m) => `${m} yerin ${r} tanesi çalışıyor`,
  adminsOnly: 'yalnızca sahip ve yöneticiler görür',
  nothing: 'Henüz bir şey yok.',
  cannotRead: 'Bu okunamadı.',
  someMissed: 'Bazı rakamlar şu an okunamadı: görünenler en son okunanlar.',
  refresh: 'Yenile',
  groups: { llm: 'LLM', agents: 'Ajanlar', work: 'İşler', tools: 'Araçlar', server: 'Sunucu' },
  period: { month: 'bu ay', days30: '30 gün', week: 'bu hafta', now: 'şu an', latest: 'son' },
  showAll: 'Tümünü göster',
  showLess: 'Daha az göster',
  subAgents: (n) => `${n} alt ajan`,
  waiting: (n) => `${n} bekliyor`,
  running: 'çalışıyor',
  memory: 'bellek',
  activity: 'Etkinlik',
  jobsNow: (r, q, a) => `${r} çalışıyor · ${q} bekliyor${a ? ` · ${a} ajan` : ''}`,
  machine: (c, m) => `CPU %${c} · bellek ${m}`,
};

export function settingsStrings(lang: UiLang): SettingsStrings {
  return lang === 'tr' ? tr : en;
}
