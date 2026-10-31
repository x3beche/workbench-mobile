/**
 * What a manager's Team sheet says (components/TeamSheet.tsx), in English and Turkish - the web's right-hand
 * column's words (frontend/src/app/rooms/team-panel.ts) and its Turkish, from its i18n.ts.
 */
import type { UiLang } from '../update/strings';

export interface TeamStrings {
  /** The sheet's title and the header button that opens it. */
  title: string;
  openTeam: string;
  /** The one line at the top: how many are under it, and how many work. */
  agentsLine: (n: number) => string;
  workingLine: (n: number) => string;
  idle: string;
  /** A task's own last word: "reported progress · ...", else "answered · ...". */
  reported: string;
  /** The line an agent holding nothing gets: "idle · last task #a1b2c3 closed 5m". */
  lastTask: string;
  noTaskYet: string;
  /** The folded foot of the task list. */
  closed: (n: number) => string;
  /** Nothing under this session yet, and nothing given to it yet. */
  none: string;
  /** The sheet could not be read. */
  failed: string;
  reading: string;
  retry: string;
  close: string;
  /** A task's status in the reader's words (the server's own word otherwise). */
  status: (s: string) => string;
  /** The share's word where a step is bigger than its window: "full" (the numbers behind it on a tap). */
  full: string;
  /** The numbers' own label, for a reader that cannot see the tap. */
  context: string;
}

const en: TeamStrings = {
  title: 'Team',
  openTeam: 'Team',
  agentsLine: (n) => (n === 1 ? '1 agent' : `${n} agents`),
  workingLine: (n) => `${n} working`,
  idle: 'idle',
  reported: 'reported',
  lastTask: 'last task',
  noTaskYet: 'no task yet',
  closed: (n) => `${n} closed`,
  none: 'No agents under this session yet.',
  failed: 'Its team could not be read.',
  reading: 'Reading its team',
  retry: 'Try again',
  close: 'Close',
  full: 'full',
  context: 'Context',
  status: (s) =>
    ({
      queued: 'queued',
      working: 'working',
      waiting: 'waiting',
      answered: 'answered',
      failed: 'failed',
      closed: 'closed',
      done: 'done',
      dropped: 'dropped',
    })[s] ?? s,
};

const tr: TeamStrings = {
  title: 'Ekip',
  openTeam: 'Ekip',
  agentsLine: (n) => (n === 1 ? '1 ajan' : `${n} ajan`),
  workingLine: (n) => `${n} çalışıyor`,
  idle: 'boşta',
  reported: 'bildirdi',
  lastTask: 'son görev',
  noTaskYet: 'henüz görev yok',
  closed: (n) => `${n} kapalı`,
  none: 'Bu oturumun altında henüz ajan yok.',
  failed: 'Ekibi okunamadı.',
  reading: 'Ekip okunuyor',
  retry: 'Yeniden dene',
  close: 'Kapat',
  full: 'dolu',
  context: 'Bağlam',
  status: (s) =>
    ({
      queued: 'sırada',
      working: 'çalışıyor',
      waiting: 'bekliyor',
      answered: 'yanıtlandı',
      failed: 'başarısız',
      closed: 'kapalı',
      done: 'tamam',
      dropped: 'bırakıldı',
    })[s] ?? s,
};

export function teamStrings(lang: UiLang): TeamStrings {
  return lang === 'tr' ? tr : en;
}
