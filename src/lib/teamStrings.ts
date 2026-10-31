/**
 * What a manager's Team sheet says (components/TeamSheet.tsx), in English and Turkish - the web's right-hand
 * column's words (frontend/src/app/rooms/team-panel.ts) and its Turkish, from its i18n.ts.
 */
import type { UiLang } from '../update/strings';

export interface TeamStrings {
  /** The sheet's title and the header button that opens it. */
  title: string;
  openTeam: string;
  /** The Agents section: the agents under the session. */
  agents: string;
  tasks: string;
  /** One agent's line: how much work it holds, or that it holds none. */
  open: (n: number) => string;
  idle: string;
  /** The folded foot of the task list. */
  closed: (n: number) => string;
  noAnswer: string;
  /** Nothing under this session yet, and nothing given to it yet. */
  none: string;
  noTasks: string;
  /** The sheet could not be read. */
  failed: string;
  reading: string;
  retry: string;
  close: string;
  /** A task's status in the reader's words (the server's own word otherwise). */
  status: (s: string) => string;
}

const en: TeamStrings = {
  title: 'Team',
  openTeam: 'Team',
  agents: 'Agents',
  tasks: 'Tasks',
  open: (n) => (n === 1 ? '1 open' : `${n} open`),
  idle: 'idle',
  closed: (n) => `${n} closed`,
  noAnswer: 'No answer yet',
  none: 'No agents under this session yet.',
  noTasks: 'No tasks yet.',
  failed: 'Its team could not be read.',
  reading: 'Reading its team',
  retry: 'Try again',
  close: 'Close',
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
  agents: 'Ajanlar',
  tasks: 'Görevler',
  open: (n) => `${n} açık`,
  idle: 'boşta',
  closed: (n) => `${n} kapalı`,
  noAnswer: 'Henüz cevap yok',
  none: 'Bu oturumun altında henüz ajan yok.',
  noTasks: 'Henüz görev yok.',
  failed: 'Ekibi okunamadı.',
  reading: 'Ekip okunuyor',
  retry: 'Yeniden dene',
  close: 'Kapat',
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
