/**
 * What the OpenCode sessions say (lib/wbo.ts, screens/OpencodeSessionScreen.tsx,
 * components/AskCard.tsx), in English and Turkish. The shape is the Claude
 * sessions' (lib/wbcStrings.ts: pictures, sending, the drawer's groups) with
 * OpenCode's own words over it; the words are the web app's
 * (frontend/src/app/rooms/opencode-sessions.ts) and so is the Turkish, from
 * its i18n.ts, wherever it has the same line.
 */
import type { UiLang } from '../update/strings';
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
  updateWbo: string;
  updateWboLong: string;
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
  earlier: string;
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
  updateWbo: 'update wb-opencode',
  updateWboLong: 'A newer wb-opencode is out: run its installer again on that computer.',
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
  earlier: 'Show earlier',
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
  updateWbo: "wb-opencode'u güncelleyin",
  updateWboLong: 'Daha yeni bir wb-opencode var: o bilgisayarda kurulum komutunu yeniden çalıştırın.',
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
  earlier: 'Öncekileri göster',
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
