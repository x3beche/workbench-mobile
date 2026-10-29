/**
 * What a conversation and a room say, in English and Turkish: the composer's
 * placeholder, what an error under the lines is called, the words over an
 * empty thread, the actions on a line. The Turkish is the web app's own where
 * it has the same words (frontend/src/app/i18n.ts).
 */
import type { MarkdownWords } from '../components/Markdown';
import type { UiLang } from '../update/strings';

export interface ChatStrings {
  retry: string;
  message: string;
  /** The composer's round button and its microphone, read out. */
  send: string;
  stopAnswer: string;
  dictate: string;
  recordNote: string;
  /** The model chooser's field, and a note that recorded nothing. */
  findModel: string;
  nothingHeard: string;
  /** The voice note's sheet: its title, the stop button, the box under it. */
  voiceNote: string;
  stopRecording: string;
  transcript: string;
  readItOver: string;
  close: string;
  /** The bar while a recording is on: what it says and its two ends. */
  transcribing: string;
  recording: string;
  stopsIn: (s: number) => string;
  recordingSeconds: (n: number) => string;
  cancelRecording: string;
  doneToText: string;
  /** The conversation's own header and the sheet that selects text. */
  moreActions: string;
  readingConversation: string;
  jumpLatest: string;
  done: string;
  discard: string;
  recordAgain: string;
  /** A row's actions, for a screen reader's own menu. */
  actions: string;
  newChat: string;
  model: string;
  chooseModel: (name: string) => string;
  /** The model sheet: what is answering now, the provider row, and while it keeps one. */
  nowModel: (name: string) => string;
  provider: string;
  saving: string;
  mayNotChoose: string;
  providersUnreadable: string;
  modelsUnreadable: string;
  copied: string;
  couldNotCopy: string;
  copy: string;
  selectText: string;
  conversationUnreadable: string;
  couldNotStart: string;
  couldNotSend: string;
  couldNotStop: string;
  answerWaiting: string;
  // Rooms
  roomUnreadable: string;
  sent: string;
  couldNotSendLine: string;
  nothingYet: string;
  roomWhy: string;
  notReadYet: string;
  intro: (room: string) => string;
  reading: string;
  readingOlder: string;
  closeRoom: string;
  closeChat: string;
  openTheConversations: string;
  heading: string;
  /** The line under the greeting on a conversation nobody has written in. */
  lead: string;
  /** What a code block and a wide table say inside an answer. */
  markdown: MarkdownWords;
}

const en: ChatStrings = {
  retry: 'Try again',
  message: 'Message',
  send: 'Send',
  stopAnswer: 'Stop the answer',
  dictate: 'Dictate a message',
  recordNote: 'Record a voice note',
  findModel: 'Find a model',
  nothingHeard: 'Nothing was heard',
  voiceNote: 'Voice note',
  stopRecording: 'Stop',
  transcript: 'Transcript',
  readItOver: 'Read it over and correct it before sending.',
  close: 'Close',
  transcribing: 'Transcribing',
  recording: 'Recording',
  stopsIn: (s) => `Stops in ${s} s`,
  recordingSeconds: (n) => `Recording, ${n} seconds`,
  cancelRecording: 'Cancel the recording',
  doneToText: 'Done: turn it into text',
  moreActions: 'More: rename, pin, archive, export, delete',
  readingConversation: 'Reading the conversation',
  jumpLatest: 'Jump to the latest message',
  done: 'Done',
  discard: 'Discard',
  recordAgain: 'Record again',
  actions: 'Actions',
  newChat: 'New chat',
  model: 'Model',
  chooseModel: (name) => `Model: ${name}. Choose another`,
  nowModel: (name) => `Now: ${name}`,
  provider: 'Provider',
  saving: 'Saving',
  mayNotChoose: 'Your account may not choose models on this server.',
  providersUnreadable: 'The providers could not be read.',
  modelsUnreadable: 'The models could not be read.',
  copied: 'Copied',
  couldNotCopy: 'Could not copy',
  copy: 'Copy',
  selectText: 'Select text',
  conversationUnreadable: 'The conversation could not be read.',
  couldNotStart: 'A new conversation could not be started.',
  couldNotSend: 'The message could not be sent.',
  couldNotStop: 'The answer could not be stopped.',
  answerWaiting: 'An answer is being written. Your message waits and is sent after it.',
  roomUnreadable: 'The room could not be read.',
  sent: 'Sent. The agent that works in this room answers here.',
  couldNotSendLine: 'The line could not be sent.',
  nothingYet: 'Nothing in this room yet',
  roomWhy:
    'Say what is to be done in it - the agent working on the drawings, the board or the firmware reads this room and answers here.',
  notReadYet: 'The agent has not read this yet.',
  intro: (room) => `${room} - the workspace keeps its own thread here, apart from your conversations.`,
  reading: 'Reading the room',
  readingOlder: 'Reading older lines',
  closeRoom: 'Close the room',
  closeChat: 'Close the conversation',
  openTheConversations: 'Open the conversations',
  heading: 'Conversation',
  lead: 'Ask about your boards, parts, firmware or models.',
  markdown: {
    code: 'code',
    copy: 'Copy',
    longPressCopy: 'Long press to copy',
    copied: 'Copied',
    copyCode: 'Copy the code',
    sidewaysCode: 'The rest of the code is to the right: swipe sideways.',
    sidewaysTable: 'The rest of the table is to the right: swipe sideways.',
  },
};

const tr: ChatStrings = {
  retry: 'Yeniden dene',
  message: 'Mesaj',
  send: 'Gönder',
  stopAnswer: 'Yanıtı durdur',
  dictate: 'Mesajı dikte et',
  recordNote: 'Sesli not kaydet',
  findModel: 'Model ara',
  nothingHeard: 'Hiçbir şey duyulmadı',
  voiceNote: 'Sesli not',
  stopRecording: 'Durdur',
  transcript: 'Metin',
  readItOver: 'Göndermeden önce okuyup düzeltin.',
  close: 'Kapat',
  transcribing: 'Yazıya çevriliyor',
  recording: 'Kaydediliyor',
  stopsIn: (s) => `${s} sn içinde durur`,
  recordingSeconds: (n) => `Kaydediliyor, ${n} saniye`,
  cancelRecording: 'Kaydı iptal et',
  doneToText: 'Bitti: yazıya çevir',
  moreActions: 'Daha fazla: adını değiştir, sabitle, arşivle, dışa aktar, sil',
  readingConversation: 'Konuşma okunuyor',
  jumpLatest: 'Son mesaja git',
  done: 'Bitti',
  discard: 'Vazgeç',
  recordAgain: 'Yeniden kaydet',
  actions: 'İşlemler',
  newChat: 'Yeni sohbet',
  model: 'Model',
  chooseModel: (name) => `Model: ${name}. Başkasını seç`,
  nowModel: (name) => `Şu an: ${name}`,
  provider: 'Sağlayıcı',
  saving: 'Kaydediliyor',
  mayNotChoose: 'Hesabınız bu sunucuda model seçemiyor.',
  providersUnreadable: 'Sağlayıcılar okunamadı.',
  modelsUnreadable: 'Modeller okunamadı.',
  copied: 'Kopyalandı',
  couldNotCopy: 'Kopyalanamadı',
  copy: 'Kopyala',
  selectText: 'Metni seç',
  conversationUnreadable: 'Sohbet okunamadı.',
  couldNotStart: 'Yeni sohbet başlatılamadı.',
  couldNotSend: 'Mesaj gönderilemedi.',
  couldNotStop: 'Yanıt durdurulamadı.',
  answerWaiting: 'Bir yanıt yazılıyor. Mesajınız bekliyor ve ondan sonra gönderilecek.',
  roomUnreadable: 'Oda okunamadı.',
  sent: 'Gönderildi. Bu odada çalışan ajan burada yanıtlar.',
  couldNotSendLine: 'Satır gönderilemedi.',
  nothingYet: 'Bu odada henüz bir şey yok',
  roomWhy:
    'Ne yapılacağını yazın - çizimlerde, kartta ya da gömülü yazılımda çalışan ajan bu odayı okur ve burada yanıtlar.',
  notReadYet: 'Ajan bunu henüz okumadı.',
  intro: (room) => `${room} - çalışma alanı kendi sohbetini burada tutar, sohbetlerinizden ayrı.`,
  reading: 'Oda okunuyor',
  readingOlder: 'Eski satırlar okunuyor',
  closeRoom: 'Odayı kapat',
  closeChat: 'Sohbeti kapat',
  openTheConversations: 'Sohbetleri aç',
  heading: 'Sohbet',
  lead: 'Kartlarınızı, parçalarınızı, gömülü yazılımı ya da modelleri sorun.',
  markdown: {
    code: 'kod',
    longPressCopy: 'Kopyalamak için basılı tut',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    copyCode: 'Kodu kopyala',
    sidewaysCode: 'Kodun gerisi sağda: yana kaydırın.',
    sidewaysTable: 'Tablonun gerisi sağda: yana kaydırın.',
  },
};

export function chatStrings(lang: UiLang): ChatStrings {
  return lang === 'tr' ? tr : en;
}
