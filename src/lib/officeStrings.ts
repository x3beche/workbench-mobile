/**
 * What the Office screen says, in English and Türkçe: the bar above the picture, the wait, and the lines for a
 * picture that did not come. The picture itself is the web's page (lib/officeEmbed.ts) and speaks its own words;
 * the app only says what a phone has to say around it.
 */
import type { UiLang } from '../update/strings';

export interface OfficeStrings {
  office: string;
  /** The bar's second line, from the page: the floor and how many agents are on it. */
  summary: (floor: string, agents: number) => string;
  /** The bar's second line until the page has said: the office is a look, never an edit. */
  readOnly: string;
  /** No pin at all: the Office shows only pinned agents, so say how to put one here. */
  pinPrompt: string;
  loading: string;
  /** The ticket could not be read: nothing to open (offline, or the server refused). */
  error: string;
  retry: string;
  /** The page opened but could not draw: a line over the space, with the page's own reason. */
  pageError: string;
}

const en: OfficeStrings = {
  office: 'Office',
  summary: (floor, agents) => `${floor} · ${agents === 1 ? '1 agent' : `${agents} agents`}`,
  readOnly: 'Read only',
  pinPrompt: 'Pin agents in the Chat’s Agents list to see them here.',
  loading: 'Opening the office…',
  error: 'The office could not be read.',
  retry: 'Try again',
  pageError: 'The office could not be drawn.',
};

const tr: OfficeStrings = {
  office: 'Ofis',
  summary: (floor, agents) => `${floor} · ${agents} ajan`,
  readOnly: 'Salt okunur',
  pinPrompt: 'Burada görmek için Chat’in Ajanlar listesinden ajan sabitleyin.',
  loading: 'Ofis açılıyor…',
  error: 'Ofis okunamadı.',
  retry: 'Yeniden dene',
  pageError: 'Ofis çizilemedi.',
};

export function officeStrings(lang: UiLang): OfficeStrings {
  return lang === 'tr' ? tr : en;
}
