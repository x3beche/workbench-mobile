/**
 * What the Orchestrator's screens say, in English and Turkish: the language
 * Account and the update follow (src/update/strings.ts uiLang). The Turkish
 * is the web app's own where it has the same words (frontend/src/app/i18n.ts).
 */
import type { UiLang } from '../update/strings';

export interface OrchStrings {
  orchestrator: string;
  drawerSnip: string;
  running: string;
  starting: string;
  restarting: string;
  stopped: string;
  settings: string;
  agentLlm: string;
  agentLlmAbout: string;
  keyRejected: string;
  creditsOut: string;
  fixAndStart: string;
  notRunning: string;
  openSettings: string;
  crashLoop: string;
  reconnecting: string;
  readOnly: string;
  nothingYet: string;
  onlyLatest: string;
  thinking: string;
  thinkingTitle: string;
  answeredIn: string;
  aRoom: string;
  handToAgent: string;
  open: string;
  agents: string;
  noAgent: string;
  atWork: (n: number) => string;
  working: string;
  done: string;
  waiting: string;
  itsTask: string;
  back: string;
  input: string;
  output: string;
  failed: string;
  mcpTools: string;
  mcpAbout: string;
  findTool: string;
  noTool: string;
  close: string;
  reasons: Record<string, string>;
  rooms: Record<string, string>;
  kinds: Record<string, string>;
  // The Agent & LLM sheet
  model: string;
  provider: string;
  pickModel: string;
  findModel: string;
  noModels: string;
  noProviders: string;
  ownKey: string;
  start: string;
  restart: string;
  stop: string;
  startingBusy: string;
  since: string;
  fixKey: string;
  restartingNow: string;
  modelSaved: string;
  cantSaveModel: string;
  cantStart: string;
  cantStop: string;
  stopTitle: string;
  stopText: string;
  openInChat: string;
  cantRead: string;
  mayNot: string;
  modelNow: (m: string) => string;
  /** Over a thread, when something new came while one reads further up. */
  newBelow: string;
}

const en: OrchStrings = {
  orchestrator: 'Orchestrator',
  drawerSnip: 'What your Orchestrator does, live',
  running: 'Running',
  starting: 'Starting…',
  restarting: 'Restarting…',
  stopped: 'Stopped',
  settings: 'Settings',
  agentLlm: 'Agent & LLM',
  agentLlmAbout: 'Your Orchestrator answers in every room and hands 3D, PCB and firmware work to its agents.',
  keyRejected: 'Your API key was rejected',
  creditsOut: 'Your provider credits ran out',
  fixAndStart: 'Fix and start again',
  notRunning: 'Your Orchestrator is not running. Pick a model and press Start; then it answers in every room.',
  openSettings: 'Open Settings',
  crashLoop: 'It keeps stopping; it is started again every 5 minutes. An admin has been told.',
  reconnecting: 'Reconnecting…',
  readOnly: 'Read-only: write in a room - the Orchestrator answers there.',
  nothingYet: 'Nothing yet: it wakes when someone writes in a room or a note is queued.',
  onlyLatest: 'Only the latest messages are shown.',
  thinking: 'thinking',
  thinkingTitle: 'Thinking',
  answeredIn: 'Answered in',
  aRoom: 'a room',
  handToAgent: 'Hand to an agent',
  open: 'Open',
  agents: 'Agents',
  noAgent: 'No agent at work.',
  atWork: (n) => (n === 1 ? '1 at work' : `${n} at work`),
  working: 'working',
  done: 'done',
  waiting: 'waiting',
  itsTask: 'Its task',
  back: 'Back to the Orchestrator',
  input: 'Input',
  output: 'Output',
  failed: 'Error',
  mcpTools: 'MCP tools',
  mcpAbout: "Workbench's MCP tools: what the Orchestrator and its agents can use",
  findTool: 'Find a tool',
  noTool: 'No tool matches.',
  close: 'Close',
  reasons: {
    unreachable: 'The Orchestrator did not answer.',
    no_session: 'It has no conversation yet.',
    no_such_session: 'This conversation is no longer there.',
    not_running: 'Its OpenCode does not answer yet.',
    other: 'Nothing to show.',
  },
  rooms: { cad: '3D Drawing', pcb: 'PCB Design', firmware: 'Firmware' },
  kinds: {
    crash: 'Crashed',
    oom: 'Out of memory',
    hang: 'Stopped answering',
    auth: 'Key rejected',
    credit: 'Credits ran out',
    manual: 'Stopped by hand',
    config: 'No model chosen',
  },
  model: 'Model',
  provider: 'Provider',
  pickModel: 'Pick a model',
  findModel: 'Find a model',
  noModels: 'No model matches.',
  noProviders: 'Add a provider and its API key on the web, in Settings > Agent & LLM; then pick the model here.',
  ownKey: 'Your own key · Workbench tools only, no shell, files or web',
  start: 'Start',
  restart: 'Restart',
  stop: 'Stop',
  startingBusy: 'Starting…',
  since: 'since',
  fixKey: 'Fix the key on the web, in Settings > Agent & LLM, then press Start.',
  restartingNow: 'It stopped and is being started again.',
  modelSaved: 'Model saved',
  cantSaveModel: 'Could not save the model',
  cantStart: 'Could not start the Orchestrator',
  cantStop: 'Could not stop the Orchestrator',
  stopTitle: 'Stop your Orchestrator?',
  stopText: 'Nobody answers in the rooms until you start it again.',
  openInChat: 'Open in Chat',
  cantRead: 'The Orchestrator could not be read.',
  mayNot: 'Your account has no Orchestrator on this server.',
  modelNow: (m) => `Now: ${m}`,
  newBelow: 'New messages',
};

const tr: OrchStrings = {
  orchestrator: 'Orkestratör',
  drawerSnip: 'Orkestratörünüzün yaptıkları, canlı',
  running: 'Çalışıyor',
  starting: 'Açılıyor…',
  restarting: 'Yeniden başlatılıyor…',
  stopped: 'Durduruldu',
  settings: 'Ayarlar',
  agentLlm: 'Ajan ve LLM',
  agentLlmAbout: 'Orkestratörünüz her odada yanıt verir; 3D, PCB ve firmware işlerini ajanlarına devreder.',
  keyRejected: 'API anahtarınız reddedildi',
  creditsOut: 'Sağlayıcı krediniz bitti',
  fixAndStart: 'Düzelt ve yeniden başlat',
  notRunning: 'Orkestratörünüz çalışmıyor. Bir model seçip Başlat’a basın; sonra her odada yanıt verir.',
  openSettings: 'Ayarları aç',
  crashLoop: 'Sürekli duruyor; her 5 dakikada bir yeniden başlatılıyor. Bir yöneticiye bildirildi.',
  reconnecting: 'Yeniden bağlanıyor…',
  readOnly: 'Salt okunur: bir odaya yazın, orkestratör orada yanıt verir.',
  nothingYet: 'Henüz bir şey yok: bir odaya yazıldığında ya da bir not kuyruğa girdiğinde uyanır.',
  onlyLatest: 'Yalnızca son mesajlar gösteriliyor.',
  thinking: 'düşünüyor',
  thinkingTitle: 'Düşünme',
  answeredIn: 'Yanıtladığı oda:',
  aRoom: 'bir oda',
  handToAgent: 'Ajana devret',
  open: 'Aç',
  agents: 'Ajanlar',
  noAgent: 'Çalışan ajan yok.',
  atWork: (n) => `${n} çalışıyor`,
  working: 'çalışıyor',
  done: 'tamam',
  waiting: 'bekleniyor',
  itsTask: 'Görevi',
  back: 'Orkestratöre dön',
  input: 'Girdi',
  output: 'Çıktı',
  failed: 'Hata',
  mcpTools: 'MCP araçları',
  mcpAbout: 'Workbench’in MCP araçları: orkestratörün ve ajanlarının kullanabildikleri',
  findTool: 'Araç bul',
  noTool: 'Eşleşen araç yok.',
  close: 'Kapat',
  reasons: {
    unreachable: 'Orkestratör yanıt vermedi.',
    no_session: 'Henüz bir konuşması yok.',
    no_such_session: 'Bu konuşma artık yok.',
    not_running: 'OpenCode’u henüz yanıt vermiyor.',
    other: 'Gösterilecek bir şey yok.',
  },
  rooms: { cad: '3D Çizim', pcb: 'PCB Tasarım', firmware: 'Firmware' },
  kinds: {
    crash: 'Çöktü',
    oom: 'Bellek yetmedi',
    hang: 'Yanıt vermeyi bıraktı',
    auth: 'Anahtar reddedildi',
    credit: 'Kredi bitti',
    manual: 'Elle durduruldu',
    config: 'Model seçilmedi',
  },
  model: 'Model',
  provider: 'Sağlayıcı',
  pickModel: 'Model seçin',
  findModel: 'Model bul',
  noModels: 'Eşleşen model yok.',
  noProviders: 'Web’de Ayarlar > Ajan ve LLM bölümünde bir sağlayıcı ve API anahtarı ekleyin; sonra modeli burada seçin.',
  ownKey: 'Kendi anahtarınız · yalnızca Workbench araçları; kabuk, dosya ya da web yok',
  start: 'Başlat',
  restart: 'Yeniden başlat',
  stop: 'Durdur',
  startingBusy: 'Açılıyor…',
  since: 'açıldı',
  fixKey: 'Anahtarı web’de Ayarlar > Ajan ve LLM bölümünde düzeltin, sonra Başlat’a basın.',
  restartingNow: 'Durdu, yeniden başlatılıyor.',
  modelSaved: 'Model kaydedildi',
  cantSaveModel: 'Model kaydedilemedi',
  cantStart: 'Orkestratör başlatılamadı',
  cantStop: 'Orkestratör durdurulamadı',
  stopTitle: 'Orkestratörünüz durdurulsun mu?',
  stopText: 'Yeniden başlatana kadar odalarda kimse yanıt vermez.',
  openInChat: 'Sohbette aç',
  cantRead: 'Orkestratör okunamadı.',
  mayNot: 'Hesabınızın bu sunucuda bir orkestratörü yok.',
  modelNow: (m) => `Şu an: ${m}`,
  newBelow: 'Yeni mesajlar',
};

export function orchStrings(lang: UiLang): OrchStrings {
  return lang === 'tr' ? tr : en;
}
