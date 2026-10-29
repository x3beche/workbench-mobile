/**
 * The words on things that have no text of their own: the dimmed ground behind
 * a sheet, the drawer a screen reader is told about, the dots of a line being
 * written. They are read out, not seen, so they live apart from the screens'
 * own words.
 */
import type { UiLang } from '../update/strings';

export interface ChromeStrings {
  close: string;
  cancel: string;
  /** The drawer itself, as a screen reader names it. */
  conversations: string;
  closeConversations: string;
  /** The three dots under a line while the answer is being written. */
  writingAnswer: string;
  /** The conversation's name in its header: back to it from the model chooser. */
  backToName: string;
  /** A dialog whose work failed, with no better reason from the server. */
  failed: string;
}

const en: ChromeStrings = {
  close: 'Close',
  cancel: 'Cancel',
  conversations: 'Conversations',
  closeConversations: 'Close the conversations',
  writingAnswer: 'Writing the answer',
  backToName: "Back to the conversation's name",
  failed: 'That did not work.',
};

const tr: ChromeStrings = {
  close: 'Kapat',
  cancel: 'Vazgeç',
  conversations: 'Sohbetler',
  closeConversations: 'Sohbetleri kapat',
  writingAnswer: 'Yanıt yazılıyor',
  backToName: 'Sohbetin adına dön',
  failed: 'Bu iş yapılamadı.',
};

export function chromeStrings(lang: UiLang): ChromeStrings {
  return lang === 'tr' ? tr : en;
}
