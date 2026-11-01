/**
 * What the Office says, in English and Turkish: the screen's title and its
 * one-line hint, the card under a tapped character, and the words for an
 * agent's state and activity (the web's `activityWord`, translated).
 */
import type { UiLang } from '../update/strings';
import type { Activity } from './office/anim';

export interface OfficeStrings {
  office: string;
  /** The top bar's second line: the floor and how many agents are in it. */
  summary: (floor: string, agents: number) => string;
  /** Under the pinched picture, until it is touched: how to move it and what a tap does. */
  hint: string;
  /** Nothing to draw: no agents, or no office yet. */
  empty: string;
  emptyAbout: string;
  error: string;
  retry: string;
  loading: string;
  /** The card. */
  close: string;
  open: string;
  /** Read-only: the screen never moves a character. */
  readOnly: string;
  task: string;
  noTask: string;
  /** The zoom buttons' labels (a pinch does the same). */
  fit: string;
  zoomIn: string;
  zoomOut: string;
  /** The words of a state as /api/office/live sends it. */
  state: Record<string, string>;
  /** The director's mark on the card, and its confidence beside it ("Jev · 82%"). */
  jev: string;
  jevWith: (pct: number) => string;
  /** Jev's temper, as the card names it under the activity. */
  mood: Record<'calm' | 'focused' | 'frustrated', string>;
  /** The "?" over a head: the director says this agent wants the person. */
  wantsYou: string;
  /** How far a task is: "~62%", and the time left in its bucket: "~<5m left" (the Team sheet's words). */
  approxPct: (pct: number) => string;
  etaLeft: (eta: string) => string;
  activity: Record<Activity, string>;
  /** "3 agents" for the header. */
  agents: (n: number) => string;
}

const en: OfficeStrings = {
  office: 'Office',
  summary: (floor, agents) => `${floor} · ${agents === 1 ? '1 agent' : `${agents} agents`}`,
  hint: 'Pinch to zoom, drag to move · tap a character',
  empty: 'The office is quiet',
  emptyAbout: 'No agent of this account is connected yet. The rooms are here; the chairs fill in when one arrives.',
  error: 'The office could not be read.',
  retry: 'Try again',
  loading: 'Opening the office…',
  close: 'Close',
  open: 'Open session',
  readOnly: 'Read only',
  task: 'Task',
  noTask: 'No open task',
  fit: 'Fit',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  state: {
    working: 'working',
    waiting: 'waiting for you',
    idle: 'idle',
    offline: 'offline',
    stalled: 'stalled',
    interrupted: 'interrupted',
    answered: 'answered',
    queued: 'queued',
  },
  activity: {
    typing: 'working at its desk',
    thinking: 'thinking',
    asking: 'waiting for you',
    break: 'on a coffee break',
    lounge: 'in the lounge',
    stuck: 'stuck',
    arrive: 'driving in',
    leave: 'leaving',
    meeting: 'in a meeting',
  },
  agents: (n) => (n === 1 ? '1 agent' : `${n} agents`),
  jev: 'Jev',
  jevWith: (pct) => `Jev · ${pct}%`,
  mood: { calm: 'calm', focused: 'focused', frustrated: 'frustrated' },
  wantsYou: 'wants you',
  approxPct: (pct) => `~${pct}%`,
  etaLeft: (eta) => `~${eta} left`,
};

const tr: OfficeStrings = {
  office: 'Ofis',
  summary: (floor, agents) => `${floor} · ${agents} ajan`,
  hint: 'Yakınlaştırmak için iki parmak · taşımak için sürükle · bir karaktere dokun',
  empty: 'Ofis sessiz',
  emptyAbout: 'Bu hesabın bağlı bir ajanı yok. Odalar burada; biri gelince sandalyesi dolar.',
  error: 'Ofis okunamadı.',
  retry: 'Yeniden dene',
  loading: 'Ofis açılıyor…',
  close: 'Kapat',
  open: 'Oturumu aç',
  readOnly: 'Salt okunur',
  task: 'Görev',
  noTask: 'Açık görev yok',
  fit: 'Sığdır',
  zoomIn: 'Yakınlaştır',
  zoomOut: 'Uzaklaştır',
  state: {
    working: 'çalışıyor',
    waiting: 'sizi bekliyor',
    idle: 'boşta',
    offline: 'çevrimdışı',
    stalled: 'takıldı',
    interrupted: 'kesildi',
    answered: 'yanıtladı',
    queued: 'sırada',
  },
  activity: {
    typing: 'masasında çalışıyor',
    thinking: 'düşünüyor',
    asking: 'sizi bekliyor',
    break: 'kahve molasında',
    lounge: 'salonda',
    stuck: 'takıldı',
    arrive: 'arabasıyla geliyor',
    leave: 'gidiyor',
    meeting: 'toplantıda',
  },
  agents: (n) => `${n} ajan`,
  jev: 'Jev',
  jevWith: (pct) => `Jev · ${pct}%`,
  mood: { calm: 'sakin', focused: 'odaklı', frustrated: 'gergin' },
  wantsYou: 'sizi istiyor',
  approxPct: (pct) => `~${pct}%`,
  etaLeft: (eta) => `~${eta} kaldı`,
};

export function officeStrings(lang: UiLang): OfficeStrings {
  return lang === 'tr' ? tr : en;
}
