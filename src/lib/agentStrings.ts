/**
 * What the drawer's Agents group says (components/AgentGroup.tsx), in English and Turkish - the web's words
 * (frontend/src/app/rooms/agents-list.ts) and its Turkish, from its i18n.ts.
 */
import type { UiLang } from '../update/strings';
import type { ArchiveWhy, WhyNot } from './agents';

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
  /** The row's menu, for an OpenCode session one may write to: its own name, on that computer too. */
  rename: string;
  renameTitle: string;
  renameField: string;
  /** The field's own label (the web's "New name"). */
  renameName: string;
  renameFailed: string;
  why: Record<WhyNot, string>;
  moveFailed: string;
  /** Out of the Agents group and into the Archived tab, and back (the web's Archive / Unarchive). */
  archive: string;
  unarchive: string;
  /** The Archived tab's group of sessions taken out of the Agents group: "Archived agents · 3". */
  archivedGroup: (n: number) => string;
  /** Why a row cannot be archived (the web's archiveWhy): said under the Archive action. */
  whyArchive: Record<ArchiveWhy, string>;
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
  rename: 'Rename',
  renameTitle: 'Rename the OpenCode session',
  renameField: 'Its own name on that computer - the TUI shows the same.',
  renameName: 'New name',
  renameFailed: 'It could not be renamed.',
  why: {
    self: 'An agent cannot manage itself.',
    circle: 'That would make a circle: the manager is under this agent already.',
    deep: 'A tree of agents is at most 3 levels deep.',
  },
  moveFailed: 'It could not be moved.',
  archive: 'Archive',
  unarchive: 'Unarchive',
  archivedGroup: (n) => `Archived agents · ${n}`,
  whyArchive: {
    manager: 'Its agents are under it - move them out first.',
    working: 'It is working.',
    waiting: 'It is waiting for you.',
  },
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
  rename: 'Yeniden adlandır',
  renameTitle: 'OpenCode oturumunu yeniden adlandır',
  renameField: 'Bilgisayarındaki kendi adı - TUI de aynısını gösterir.',
  renameName: 'Yeni ad',
  renameFailed: 'Yeniden adlandırılamadı.',
  why: {
    self: 'Bir ajan kendini yönetemez.',
    circle: 'Bu bir döngü olur: yönetici zaten bu ajanın altında.',
    deep: 'Bir ajan ağacı en fazla 3 kademe olabilir.',
  },
  moveFailed: 'Taşınamadı.',
  archive: 'Arşivle',
  unarchive: 'Arşivden çıkar',
  archivedGroup: (n) => `Arşivlenen ajanlar · ${n}`,
  whyArchive: {
    manager: 'Ajanları bunun altında - önce onları çıkar.',
    working: 'Çalışıyor.',
    waiting: 'Seni bekliyor.',
  },
};

export function agentStrings(lang: UiLang): AgentStrings {
  return lang === 'tr' ? tr : en;
}
