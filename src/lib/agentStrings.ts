/**
 * What the drawer's Agents group says (components/AgentGroup.tsx), in English and Turkish - the web's words
 * (frontend/src/app/rooms/agents-list.ts) and its Turkish, from its i18n.ts.
 */
import type { UiLang } from '../update/strings';
import type { WhyNot } from './agents';

export interface AgentStrings {
  group: string;
  putUnder: (name: string) => string;
  onItsOwn: string;
  team: (n: number, working: number) => string;
  /** The folded head's summary: how many, working, waiting for the person. */
  summary: (n: number, working: number, waiting: number) => string;
  showOlder: (n: number) => string;
  hideOlder: string;
  showTeam: string;
  hideTeam: string;
  why: Record<WhyNot, string>;
  moveFailed: string;
}

const en: AgentStrings = {
  group: 'Agents',
  putUnder: (name) => `Put under ${name}`,
  onItsOwn: 'On its own',
  team: (n, working) => `${n === 1 ? '1 agent' : `${n} agents`}${working ? ` · ${working} working` : ''}`,
  summary: (n, working, waiting) => [`${n}`, working ? `${working} working` : '', waiting ? `${waiting} waiting` : ''].filter(Boolean).join(' · '),
  showOlder: (n) => `Show ${n} older`,
  hideOlder: 'Hide the older ones',
  showTeam: 'Show its agents',
  hideTeam: 'Hide its agents',
  why: {
    self: 'An agent cannot manage itself.',
    circle: 'That would make a circle: the manager is under this agent already.',
    deep: 'A tree of agents is at most 3 levels deep.',
  },
  moveFailed: 'It could not be moved.',
};

const tr: AgentStrings = {
  group: 'Ajanlar',
  putUnder: (name) => `${name} altına koy`,
  onItsOwn: 'Bağımsız yap',
  team: (n, working) => `${n} ajan${working ? ` · ${working} çalışıyor` : ''}`,
  summary: (n, working, waiting) => [`${n}`, working ? `${working} çalışıyor` : '', waiting ? `${waiting} bekliyor` : ''].filter(Boolean).join(' · '),
  showOlder: (n) => `${n} eski oturumu göster`,
  hideOlder: 'Eskileri gizle',
  showTeam: 'Ajanlarını göster',
  hideTeam: 'Ajanlarını gizle',
  why: {
    self: 'Bir ajan kendini yönetemez.',
    circle: 'Bu bir döngü olur: yönetici zaten bu ajanın altında.',
    deep: 'Bir ajan ağacı en fazla 3 kademe olabilir.',
  },
  moveFailed: 'Taşınamadı.',
};

export function agentStrings(lang: UiLang): AgentStrings {
  return lang === 'tr' ? tr : en;
}
