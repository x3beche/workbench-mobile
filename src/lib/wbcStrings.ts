/**
 * What the Claude sessions say (lib/wbc.ts, screens/ClaudeSessionScreen.tsx),
 * in English and Turkish, in the language Account and the Orchestrator
 * follow (update/strings.ts uiLang). The words are the web app's
 * (frontend/src/app/rooms/claude-sessions.ts) and so is the Turkish, from its
 * i18n.ts, wherever it has the same line.
 */
import type { UiLang } from '../update/strings';

export interface WbcStrings {
  group: string;
  session: string;
  claudeCode: string;
  claude: string;
  you: string;
  itsPerson: string;
  /** The bridge's state, and the session's when none holds it. */
  atPrompt: string;
  working: string;
  waitingComputer: string;
  starting: string;
  notConnected: string;
  status: Record<'active' | 'idle' | 'ended', string>;
  connected: string;
  remoteOff: string;
  updateWbc: string;
  updateWbcLong: string;
  fromWorkbench: string;
  cut: string;
  readByTool: string;
  picturesGone: string;
  pictureGone: string;
  showWhole: string;
  picture: (n: number) => string;
  close: string;
  nothingYet: string;
  readingOlder: string;
  reading: string;
  /** The button under a read that failed. */
  retry: string;
  /** The box's empty words: the web's "write to this Claude Code session…", short enough for one line on a phone. */
  placeholder: string;
  /** The chip that puts Claude Code's suggestion in the box. */
  useSuggestion: string;
  // a sent message's state
  sentWaiting: string;
  queuedTyping: string;
  queuedDialog: string;
  queuedStarting: string;
  queuedWorking: string;
  delivered: string;
  refused: string;
  expired: string;
  notDelivered: string;
  // why the composer is a note
  why: {
    notYours: (who: string) => string;
    noBridge: string;
    remoteOff: string;
    imp: string;
    mismatch: string;
    other: string;
  };
  // pictures in the composer
  attach: string;
  fromPhotos: string;
  fromCamera: string;
  updateForPictures: string;
  atMost: (n: number) => string;
  onlyTypes: string;
  tooLarge: (mb: number) => string;
  noCamera: string;
  remove: string;
  tooMany: string;
  cantReach: string;
  cantRead: string;
  newBelow: string;
  back: string;
  menu: string;
  // the drawer's groups (Claude sessions, OpenCode sessions): folding and pins, as the web's list
  foldList: string;
  unfoldList: string;
  showMore: (n: number) => string;
  pin: string;
  unpin: string;
  pinned: string;
  open: string;
  /** The server's own words, as the web translates them. */
  server: Record<string, string>;
}

const en: WbcStrings = {
  group: 'Claude sessions',
  session: 'Claude session',
  claudeCode: 'Claude Code',
  claude: 'Claude',
  you: 'you',
  itsPerson: 'its person',
  atPrompt: 'at the prompt',
  working: 'working',
  waitingComputer: 'waiting for an answer on the computer',
  starting: 'starting',
  notConnected: 'not connected',
  status: { active: 'active', idle: 'idle', ended: 'ended' },
  connected: 'wb-claude connected',
  remoteOff: 'remote off',
  updateWbc: 'update wb-claude',
  updateWbcLong: 'A newer wb-claude is out: run its installer again on that computer.',
  fromWorkbench: 'from Workbench',
  cut: 'cut at its length limit',
  readByTool: 'read by a tool',
  picturesGone: 'pictures no longer kept',
  pictureGone: 'That picture is no longer kept.',
  showWhole: 'Show the whole picture',
  picture: (n) => `Picture ${n}`,
  close: 'Close',
  nothingYet: 'Nothing recorded yet: prompts and answers appear here as the session uses the Claude pool.',
  readingOlder: 'Reading earlier turns',
  reading: 'Reading the session',
  retry: 'Try again',
  placeholder: 'Write to this session…',
  useSuggestion: 'Use',
  sentWaiting: 'sent — waiting for the computer',
  queuedTyping: 'queued — you are typing on the computer',
  queuedDialog: 'queued — Claude is asking something on the computer',
  queuedStarting: 'queued — Claude is starting',
  queuedWorking: 'queued — Claude is working',
  delivered: 'delivered',
  refused: 'refused: remote messages are off on that computer',
  expired: 'not delivered: no wb-claude took it within an hour',
  notDelivered: 'not delivered',
  why: {
    notYours: (who) => `Only ${who} can write to this session; you can read it.`,
    noBridge:
      'To write to this session from here, start it on its computer with wb-claude instead of claude (Settings > Claude pool > Connect).',
    remoteOff: 'wb-claude is connected, but remote messages are turned off on that computer.',
    imp: 'Signed in as someone else: you can read this session, not write to it.',
    mismatch: 'The connected wb-claude uses another key than this session.',
    other: 'Read-only.',
  },
  attach: 'Attach pictures',
  fromPhotos: 'Photos',
  fromCamera: 'Camera',
  updateForPictures: 'Update wb-claude on that computer to send pictures (run its installer again).',
  atMost: (n) => `At most ${n} pictures with one message.`,
  onlyTypes: 'Only png, jpeg, gif and webp pictures can be sent.',
  tooLarge: (mb) => `A picture is at most ${mb} MB.`,
  noCamera: 'The camera is not allowed for Workbench. Allow it in the phone’s settings.',
  remove: 'Remove',
  tooMany: 'too many messages — wait a little',
  cantReach: 'Could not reach the server.',
  cantRead: 'The session could not be read.',
  newBelow: 'New messages',
  back: 'Close the session',
  menu: 'Open the conversations',
  foldList: 'Fold this list',
  unfoldList: 'Unfold this list',
  showMore: (n) => `Show ${n} more`,
  pin: 'Pin',
  unpin: 'Unpin',
  pinned: 'pinned',
  open: 'Open',
  server: {},
};

const tr: WbcStrings = {
  group: 'Claude oturumları',
  session: 'Claude oturumu',
  claudeCode: 'Claude Code',
  claude: 'Claude',
  you: 'siz',
  itsPerson: 'sahibi',
  atPrompt: 'istemde bekliyor',
  working: 'çalışıyor',
  waitingComputer: 'bilgisayarda bir yanıt bekliyor',
  starting: 'başlıyor',
  notConnected: 'bağlı değil',
  status: { active: 'etkin', idle: 'boşta', ended: 'bitti' },
  connected: 'wb-claude bağlı',
  remoteOff: 'uzaktan kapalı',
  updateWbc: "wb-claude'ı güncelleyin",
  updateWbcLong: 'Daha yeni bir wb-claude var: o bilgisayarda kurulum komutunu yeniden çalıştırın.',
  fromWorkbench: "Workbench'ten",
  cut: 'uzunluk sınırında kesildi',
  readByTool: 'bir aracın okudukları',
  picturesGone: 'resimler artık saklanmıyor',
  pictureGone: 'Bu resim artık saklanmıyor.',
  showWhole: 'Resmin tamamını göster',
  picture: (n) => `Resim ${n}`,
  close: 'Kapat',
  nothingYet: 'Henüz kayıt yok: oturum Claude havuzunu kullandıkça istemler ve yanıtlar burada görünür.',
  readingOlder: 'Önceki turlar okunuyor',
  reading: 'Oturum okunuyor',
  retry: 'Yeniden dene',
  placeholder: 'Bu oturuma yazın…',
  useSuggestion: 'Kullan',
  sentWaiting: 'gönderildi — bilgisayar bekleniyor',
  queuedTyping: 'sırada — bilgisayarda yazıyorsunuz',
  queuedDialog: 'sırada — Claude bilgisayarda bir şey soruyor',
  queuedStarting: 'sırada — Claude başlıyor',
  queuedWorking: 'sırada — Claude çalışıyor',
  delivered: 'teslim edildi',
  refused: 'reddedildi: o bilgisayarda uzaktan mesajlar kapalı',
  expired: 'iletilmedi: bir saat içinde hiçbir wb-claude almadı',
  notDelivered: 'iletilmedi',
  why: {
    notYours: (who) => `Bu oturuma yalnızca ${who} yazabilir; siz okuyabilirsiniz.`,
    noBridge:
      'Bu oturuma buradan yazmak için onu kendi bilgisayarında claude yerine wb-claude ile başlatın (Ayarlar > Claude havuzu > Bağlan).',
    remoteOff: 'wb-claude bağlı, ancak o bilgisayarda uzaktan mesajlar kapalı.',
    imp: 'Başkası olarak oturum açtınız: bu oturumu okuyabilir, ama yazamazsınız.',
    mismatch: 'Bağlı wb-claude bu oturumdan farklı bir anahtar kullanıyor.',
    other: 'Salt okunur.',
  },
  attach: 'Resim ekleyin',
  fromPhotos: 'Fotoğraflar',
  fromCamera: 'Kamera',
  updateForPictures:
    "Resim göndermek için o bilgisayardaki wb-claude'ı güncelleyin (kurulum komutunu yeniden çalıştırın).",
  atMost: (n) => `Bir mesajla en fazla ${n} resim gider.`,
  onlyTypes: 'Yalnızca png, jpeg, gif ve webp resimler gönderilebilir.',
  tooLarge: (mb) => `Bir resim en fazla ${mb} MB olabilir.`,
  noCamera: 'Workbench için kameraya izin verilmemiş. Telefonun ayarlarından izin verin.',
  remove: 'Kaldır',
  tooMany: 'çok fazla mesaj — biraz bekleyin',
  cantReach: 'Sunucuya ulaşılamadı.',
  cantRead: 'Oturum okunamadı.',
  newBelow: 'Yeni mesajlar',
  back: 'Oturumu kapat',
  menu: 'Sohbetleri aç',
  foldList: 'Bu listeyi daralt',
  unfoldList: 'Bu listeyi aç',
  showMore: (n) => `${n} tane daha göster`,
  pin: 'Sabitle',
  unpin: 'Sabitlemeyi kaldır',
  pinned: 'sabitlendi',
  open: 'Aç',
  // The server's refusals, as the web app's i18n.ts writes them in Turkish.
  server: {
    'no wb-claude is connected to this session': 'bu oturuma bağlı bir wb-claude yok',
    'remote messages are turned off on that computer': 'o bilgisayarda uzaktan mesajlar kapalı',
    "only the session's own person may write to it": 'bu oturuma yalnızca sahibi yazabilir',
    'too many messages — wait a little': 'çok fazla mesaj — biraz bekleyin',
    'the wb-claude on that computer is too old to take pictures - run its installer again':
      'o bilgisayardaki wb-claude resim alamayacak kadar eski - kurulum komutunu yeniden çalıştırın',
    'only png, jpeg, gif and webp pictures can be sent': 'yalnızca png, jpeg, gif ve webp resimler gönderilebilir',
    'a picture is at most 5 MB': 'bir resim en fazla 5 MB olabilir',
    'at most 4 pictures with one message': 'bir mesajla en fazla 4 resim gider',
    'at most 4 pictures of 5 MB each': 'en fazla 4 resim, her biri 5 MB',
    'that picture is no longer kept': 'bu resim artık saklanmıyor',
    'the message is empty': 'mesaj boş',
  },
};

export function wbcStrings(lang: UiLang): WbcStrings {
  return lang === 'tr' ? tr : en;
}
