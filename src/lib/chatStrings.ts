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
  newChat: string;
  model: string;
  chooseModel: (name: string) => string;
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
  newChat: 'New chat',
  model: 'Model',
  chooseModel: (name) => `Model: ${name}. Choose another`,
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
    copied: 'Copied',
    copyCode: 'Copy the code',
    sidewaysCode: 'The rest of the code is to the right: swipe sideways.',
    sidewaysTable: 'The rest of the table is to the right: swipe sideways.',
  },
};

const tr: ChatStrings = {
  retry: 'Yeniden dene',
  message: 'Mesaj',
  newChat: 'Yeni sohbet',
  model: 'Model',
  chooseModel: (name) => `Model: ${name}. Başkasını seç`,
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
