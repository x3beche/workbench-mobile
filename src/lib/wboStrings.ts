/**
 * What the OpenCode sessions say (lib/wbo.ts, screens/OpencodeSessionScreen.tsx,
 * components/AskCard.tsx), in English and Turkish. The shape is the Claude
 * sessions' (lib/wbcStrings.ts: pictures, sending, the drawer's groups) with
 * OpenCode's own words over it; the words are the web app's
 * (frontend/src/app/rooms/opencode-sessions.ts) and so is the Turkish, from
 * its i18n.ts, wherever it has the same line.
 */
import type { UiLang } from '../update/strings';
import type { RunWords } from './runStats';
import { wbcStrings, type WbcStrings } from './wbcStrings';

export interface WboStrings extends WbcStrings {
  opencode: string;
  onComputer: string;
  ready: string;
  retrying: string;
  waitingAnswer: string;
  writing: string;
  thinking: string;
  thought: string;
  ranTools: (n: number, failed: number) => string;
  onlyLatest: string;
  updateWboLong: string;
  /** The header's pill, with "0.1.0 → 0.2.0" after it. */
  updateWboTitle: string;
  // a question drawn from the tool's own call, not answerable here
  updateToAnswer: string;
  answerOnComputer: string;
  waitingAnAnswer: string;
  answered: string;
  // what OpenCode asks
  asks: string;
  asksToRun: (x: string) => string;
  other: string;
  yourAnswer: string;
  answer: string;
  allowOnce: string;
  alwaysAllow: string;
  reject: string;
  fromNowOn: (x: string) => string;
  allowedOnce: string;
  alwaysAllowed: string;
  rejected: string;
  sendingAnswer: string;
  answeredChat: string;
  answeredComputer: string;
  noLonger: string;
  readingOlderMsgs: string;
  /** The button under a read that failed. */
  retry: string;
  earlier: string;
  model: string;
  pickModel: string;
  noModels: string;
  modelSwitched: (from: string, to: string, who: string) => string;
  fromChat: string;
  onComp: string;
  initial: string;
  notConnectedComp: string;
  remoteOffComp: string;
  updateWboModels: string;
  onlyOwnerCanChoose: string;
  appliesNextMessage: string;
  /** The stats under an answer: its line and the card it opens (lib/runStats.ts). */
  run: RunWords;
  // the session's column (lib/wboPanel.ts, the sheet the "i" button opens)
  columnTitle: string;
  columnAria: string;
  computer: string;
  todos: string;
  changedFiles: string;
  waiting: string;
  tools: string;
  idle: string;
  errorWord: string;
  doneOf: (done: number, total: number) => string;
  touchedTimes: (n: number) => string;
  moreFiles: (n: number) => string;
  moreTools: (n: number) => string;
  failedTimes: (n: number) => string;
  onlyOwnerAnswers: string;
  answerItOnComputer: string;
  showInConversation: string;
  readingColumn: string;
  columnFailed: string;
  updateWbo: string;
  notConnectedShort: string;
  sessions: string;
  /** What it spent, where the numbers came from, and the window's own line. */
  editsTimes: (n: number) => string;
  callsTimes: (n: number) => string;
  ofItsWindow: string;
  leftOfWindow: string;
  compactsItself: string;
  lastMessages: (n: number) => string;
  deviceKey: string;
  tempFiles: string;
  connectedShort: string;
  allFiles: (n: number) => string;
  thinkingLevel: (v: string) => string;
  copy: string;
  copied: string;
  /** The four numbers of what it spent, worded as the web's column words them. */
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
}

const wen = wbcStrings('en');
const wtr = wbcStrings('tr');

const en: WboStrings = {
  ...wen,
  group: 'OpenCode sessions',
  session: 'OpenCode session',
  opencode: 'OpenCode',
  connected: 'wb-opencode connected',
  onComputer: 'On the computer',
  working: 'working',
  ready: 'ready',
  retrying: 'retrying',
  waitingAnswer: 'waiting for your answer',
  writing: 'writing…',
  thinking: 'thinking…',
  thought: 'Thought it through',
  ranTools: (n, failed) => `Ran ${n} tools${failed ? `, ${failed} failed` : ''}`,
  onlyLatest: 'Only the latest messages are shown.',
  updateWboLong: 'A newer wb-opencode is out: run its installer again on that computer.',
  updateWboTitle: 'Update wb-opencode',
  updateToAnswer: 'Update wb-opencode on that computer to answer here (run its installer again)',
  answerOnComputer: 'Answer it on the computer',
  waitingAnAnswer: 'waiting for an answer',
  answered: 'answered',
  nothingYet: 'Nothing here yet: the conversation appears as OpenCode on that computer writes it.',
  expired: 'not delivered: no wb-opencode took it within an hour',
  why: {
    ...wen.why,
    noBridge:
      'To write to this session from here, start OpenCode on its computer with wb-opencode (Settings > OpenCode > Connect).',
    remoteOff: 'wb-opencode is connected, but remote messages are turned off on that computer.',
  },
  asks: 'OpenCode asks',
  asksToRun: (x) => `OpenCode asks to run ${x}`,
  other: 'Other: your own answer',
  yourAnswer: 'Your answer',
  answer: 'Answer',
  allowOnce: 'Allow once',
  alwaysAllow: 'Always allow',
  reject: 'Reject',
  fromNowOn: (x) => `From now on: ${x}`,
  allowedOnce: 'Allowed once',
  alwaysAllowed: 'Always allowed',
  rejected: 'Rejected',
  sendingAnswer: 'sending your answer…',
  answeredChat: 'answered from the Chat',
  answeredComputer: 'answered on the computer',
  noLonger: 'no longer asked',
  readingOlderMsgs: 'Reading earlier messages',
  retry: 'Try again',
  earlier: 'Show earlier',
  model: 'Model',
  pickModel: 'Pick a model',
  noModels: 'No model matches.',
  modelSwitched: (from, to, who) => `Model changed: ${from} → ${to} (${who})`,
  fromChat: 'from Chat',
  onComp: 'on the computer',
  initial: 'initial',
  notConnectedComp: 'The computer is not connected',
  remoteOffComp: 'Remote messages are off on that computer (--no-remote)',
  updateWboModels: 'Update wb-opencode on that computer (at least 0.2.8)',
  onlyOwnerCanChoose: 'Only the owner of this session can choose its model',
  appliesNextMessage: 'applies from the next message',
  columnTitle: 'Session',
  columnAria: 'What this session is doing',
  computer: 'Computer',
  todos: 'To-dos',
  changedFiles: 'Changed files',
  waiting: 'Waiting',
  tools: 'Tools',
  /** The run's own section, and the one line above the sections when something waits. */
  now: 'Now',
  last: 'Last',
  permissions: (n) => `${n} permission${n === 1 ? '' : 's'}`,
  questions: (n) => `${n} question${n === 1 ? '' : 's'}`,
  answerInConversation: 'answer it in the conversation',
  stoppedUntilAnswered: 'the run is stopped until it is answered',
  inTok: 'in',
  outTok: 'out',
  /** The graphs' own few words. */
  compactionTurns: (n) => `at this pace, compaction in ~${n} turns`,
  turnNo: (n) => `turn ${n}`,
  compacted: 'compacted',
  outputPerMinute: 'output tokens a minute',
  nothingNew: (n) => `nothing new for ${n} min`,
  min15: '15 min',
  hour1: '1 hour',
  all: 'all',
  whichTools: 'which tools',
  hideTools: 'hide the tools',
  reading: 'reading',
  editing: 'editing',
  shellCat: 'shell',
  webCat: 'web',
  subAgent: 'sub-agent',
  writingCat: 'writing',
  otherCat: 'other',
  mcpNone: 'MCP none',
  idle: 'idle',
  errorWord: 'error',
  doneOf: (done, total) => `${done}/${total} done`,
  touchedTimes: (n) => `touched ${n} times`,
  moreFiles: (n) => `and ${n} more`,
  moreTools: (n) => `and ${n} more`,
  failedTimes: (n) => `${n} failed`,
  onlyOwnerAnswers: 'Only the owner of this session can answer it',
  answerItOnComputer: 'Answer this one on the computer: it asks more than this card holds.',
  showInConversation: 'Show it in the conversation',
  readingColumn: 'Reading the session…',
  columnFailed: 'Could not read the session',
  updateWbo: 'Update wb-opencode',
  notConnectedShort: 'not connected',
  sessions: 'Sessions',
  editsTimes: (n) => `${n} edits`,
  callsTimes: (n) => `${n} calls`,
  ofItsWindow: 'of its window',
  leftOfWindow: 'left',
  compactsItself: 'OpenCode compacts a session by itself when the window is nearly full',
  lastMessages: (n) => `The last ${n} messages: the session's own total is not kept for this one.`,
  deviceKey: 'device key',
  tempFiles: 'Temporary files',
  connectedShort: 'connected',
  allFiles: (n) => `All ${n} files`,
  thinkingLevel: (v) => `thinking: ${v}`,
  copy: 'Copy',
  copied: 'Copied',
  input: 'Input',
  output: 'Output',
  cacheRead: 'Cache read',
  cacheWrite: 'Cache write',
  run: {
    details: 'Details',
    sent: 'Sent',
    firstToken: 'First token',
    finished: 'Finished',
    firstTokenIn: 'Time to first token',
    speed: 'Average speed',
    thinking: 'Thinking',
    writing: 'Writing',
    total: 'Total time',
    tokensIn: 'Tokens in',
    fromCache: 'From cache',
    writtenToCache: 'Written to cache',
    tokensOut: 'Tokens out',
    thinkingTokens: 'Thinking tokens',
    totalTokens: 'Total tokens',
    contextUsed: 'Context used',
    cost: 'Cost',
    model: 'Model',
    status: 'Status',
    stopped: 'stopped',
    interrupted: 'interrupted',
    failed: 'failed',
    done: 'finished',
    restarted: 'The server restarted while it was being written.',
  },
};

const tr: WboStrings = {
  ...wtr,
  group: 'OpenCode oturumları',
  session: 'OpenCode oturumu',
  opencode: 'OpenCode',
  connected: 'wb-opencode bağlı',
  onComputer: 'Bilgisayarda',
  working: 'çalışıyor',
  ready: 'hazır',
  retrying: 'yeniden deniyor',
  waitingAnswer: 'cevabınızı bekliyor',
  writing: 'yazıyor…',
  thinking: 'düşünüyor…',
  thought: 'Düşünme',
  ranTools: (n, failed) => `${n} araç çalıştı${failed ? `, ${failed} tanesi başarısız` : ''}`,
  onlyLatest: 'Yalnızca son mesajlar gösteriliyor.',
  updateWboLong: 'Daha yeni bir wb-opencode var: o bilgisayarda kurulum komutunu yeniden çalıştırın.',
  updateWboTitle: "wb-opencode'u güncelleyin",
  updateToAnswer:
    "Buradan cevaplamak için o bilgisayarda wb-opencode'u güncelleyin (kurulum komutunu yeniden çalıştırın)",
  answerOnComputer: 'Bilgisayarda cevaplayın',
  waitingAnAnswer: 'cevap bekleniyor',
  answered: 'yanıtlandı',
  nothingYet: 'Burada henüz bir şey yok: o bilgisayardaki OpenCode yazdıkça konuşma burada görünür.',
  expired: 'iletilmedi: bir saat içinde hiçbir wb-opencode almadı',
  why: {
    ...wtr.why,
    noBridge:
      "Bu oturuma buradan yazmak için OpenCode'u kendi bilgisayarında wb-opencode ile başlatın (Ayarlar > OpenCode > Bağlan).",
    remoteOff: 'wb-opencode bağlı, ancak o bilgisayarda uzaktan mesajlar kapalı.',
  },
  asks: 'OpenCode soruyor',
  asksToRun: (x) => `OpenCode ${x} çalıştırmak için izin istiyor`,
  other: 'Diğer: kendi cevabınız',
  yourAnswer: 'Cevabınız',
  answer: 'Yanıt',
  allowOnce: 'Bir kez izin ver',
  alwaysAllow: 'Her zaman izin ver',
  reject: 'Reddet',
  fromNowOn: (x) => `Bundan sonra: ${x}`,
  allowedOnce: 'Bir kez izin verildi',
  alwaysAllowed: 'Her zaman izin verildi',
  rejected: 'Reddedildi',
  sendingAnswer: 'cevabınız gönderiliyor…',
  answeredChat: "Sohbet'ten cevaplandı",
  answeredComputer: 'bilgisayarda cevaplandı',
  noLonger: 'artık sorulmuyor',
  readingOlderMsgs: 'Önceki mesajlar okunuyor',
  retry: 'Yeniden dene',
  earlier: 'Öncekileri göster',
  model: 'Model',
  pickModel: 'Model seçin',
  noModels: 'Eşleşen model yok.',
  modelSwitched: (from, to, who) => `Model değişti: ${from} → ${to} (${who})`,
  fromChat: "Chat'ten",
  onComp: 'Bilgisayardan',
  initial: 'başlangıç',
  notConnectedComp: 'Bilgisayar bağlı değil',
  remoteOffComp: 'Uzaktan mesaj kapalı (--no-remote)',
  updateWboModels: "O bilgisayarda wb-opencode'u güncelleyin (en az 0.2.8)",
  onlyOwnerCanChoose: 'Sadece oturumun sahibi model seçebilir',
  appliesNextMessage: 'sıradaki mesajdan itibaren geçerli',
  columnTitle: 'Oturum',
  columnAria: 'Bu oturumun ne yaptığı',
  computer: 'Bilgisayar',
  todos: 'Yapılacaklar',
  changedFiles: 'Değişen dosyalar',
  waiting: 'Bekleyen',
  tools: 'Araçlar',
  now: 'Şu an',
  last: 'Son',
  permissions: (n) => `${n} izin`,
  questions: (n) => `${n} soru`,
  answerInConversation: 'konuşmada yanıtlayın',
  stoppedUntilAnswered: 'yanıtlanana kadar çalışma durdu',
  inTok: 'girdi',
  outTok: 'çıktı',
  compactionTurns: (n) => `Bu hızla ~${n} tur sonra sıkıştırma`,
  turnNo: (n) => `${n}. tur`,
  compacted: 'sıkıştırıldı',
  outputPerMinute: 'dakikadaki çıktı tokenı',
  nothingNew: (n) => `${n} dk’dır yeni bir şey yok`,
  min15: '15 dk',
  hour1: '1 saat',
  all: 'tümü',
  whichTools: 'hangi araçlar',
  hideTools: 'araçları gizle',
  reading: 'okuma',
  editing: 'düzenleme',
  shellCat: 'kabuk',
  webCat: 'web',
  subAgent: 'alt ajan',
  writingCat: 'yazma',
  otherCat: 'diğer',
  mcpNone: 'MCP yok',
  idle: 'boşta',
  errorWord: 'hata',
  doneOf: (done, total) => `${done}/${total} tamam`,
  touchedTimes: (n) => `${n} kez dokunuldu`,
  moreFiles: (n) => `ve ${n} tane daha`,
  moreTools: (n) => `ve ${n} tane daha`,
  failedTimes: (n) => `${n} hatalı`,
  onlyOwnerAnswers: 'Sadece oturumun sahibi yanıtlayabilir',
  answerItOnComputer: 'Bunu bilgisayarda yanıtlayın: bu kartın sığdığından fazlasını soruyor.',
  showInConversation: 'Konuşmada göster',
  readingColumn: 'Oturum okunuyor…',
  columnFailed: 'Oturum okunamadı',
  updateWbo: "wb-opencode'u güncelleyin",
  notConnectedShort: 'bağlı değil',
  sessions: 'Oturumlar',
  editsTimes: (n) => `${n} düzenleme`,
  callsTimes: (n) => `${n} çağrı`,
  ofItsWindow: 'penceresinin',
  leftOfWindow: 'kaldı',
  compactsItself: 'OpenCode pencere dolmak üzereyken oturumu kendi sıkıştırır (compaction)',
  lastMessages: (n) => `Son ${n} mesaj: bu oturumun kendi toplamı saklanmamış.`,
  deviceKey: 'cihaz anahtarı',
  tempFiles: 'Geçici dosyalar',
  connectedShort: 'bağlı',
  allFiles: (n) => `${n} dosyanın tümü`,
  thinkingLevel: (v) => `düşünme: ${v}`,
  copy: 'Kopyala',
  copied: 'Kopyalandı',
  input: 'Girdi',
  output: 'Çıkış',
  cacheRead: 'Cache okuma',
  cacheWrite: 'Cache yazma',
  // The web app's i18n.ts, in Turkish, for the stats under an answer.
  run: {
    details: 'Ayrıntılar',
    sent: 'Gönderilen',
    firstToken: 'İlk token',
    finished: 'Bitti',
    firstTokenIn: 'İlk tokene kadar geçen süre',
    speed: 'Ortalama hız',
    thinking: 'Düşünme',
    writing: 'Yazma',
    total: 'Toplam süre',
    tokensIn: 'Giren token',
    fromCache: 'Önbellekten',
    writtenToCache: 'Önbelleğe yazılan',
    tokensOut: 'Çıkan token',
    thinkingTokens: 'Düşünme tokenleri',
    totalTokens: 'Toplam token',
    contextUsed: 'Kullanılan bağlam',
    cost: 'Maliyet',
    model: 'Model',
    status: 'Durum',
    stopped: 'durdu',
    interrupted: 'yarıda kaldı',
    failed: 'başarısız',
    done: 'tamamlandı',
    restarted: 'Yazılırken sunucu yeniden başladı.',
  },
  // The server's refusals, as the web app's i18n.ts writes them in Turkish.
  server: {
    ...wtr.server,
    'no wb-opencode is connected to this session': 'bu oturuma bağlı bir wb-opencode yok',
    'already answered': 'zaten cevaplandı',
    'OpenCode no longer asks this': 'OpenCode artık bunu sormuyor',
    'the wb-opencode on that computer is too old to answer from here - run its installer again':
      'o bilgisayardaki wb-opencode buradan cevap vermek için çok eski - kurulum komutunu yeniden çalıştırın',
    'answer the questions that were asked': 'sorulan sorulara cevap verin',
    'that is not one of the choices': 'bu, seçeneklerden biri değil',
  },
};

export function wboStrings(lang: UiLang): WboStrings {
  return lang === 'tr' ? tr : en;
}
