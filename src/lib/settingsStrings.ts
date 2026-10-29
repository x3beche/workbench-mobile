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
  /** How many different tools were used this week - the home screen widget's head. */
  toolCount: (n: number) => string;
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
  toolCount: (n) => (n === 1 ? '1 tool' : `${n} tools`),
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
