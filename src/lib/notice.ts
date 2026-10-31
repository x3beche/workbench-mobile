/**
 * A notification turn from Workbench sent to a manager Claude Code session:
 * "[Workbench] #676936 MOBIL-PANEL-YAMA-1.9.27 - answered: <summary>"
 * Dropped from user bubbles and drawn as a centered, small system row.
 */

export interface NoticeTask {
  id: string;
  name: string;
  state: string;
  summary?: string;
}

/**
 * Parses a Workbench notification message into its tasks.
 * Returns null if the text is not a Workbench notification.
 */
export function parseNotice(text: string, kind?: string): NoticeTask[] | null {
  if (!text || typeof text !== 'string') return null;
  const match = /^\s*\[Workbench\]\s*([\s\S]*)$/.exec(text);
  // What a message is, the server marks where it is stored (`kind: "notify"`, backend/wbclaude.py): a marked
  // one is a notification with or without the prefix, and the prefix stays the way of the lines written before.
  const body = match ? match[1] : kind === 'notify' ? text : null;
  if (body === null) return null;

  const tasks: NoticeTask[] = [];
  const lines = body.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Drop trailing "(task_status ...)" lines
    if (/^\(.*?\)$/.test(line)) continue;

    // Pattern: #<id> <name> - <state>[: <summary>]
    // Name can contain "-", ".", letters, numbers. Separator is " - " (space, hyphen, space).
    const hit = /^#([A-Za-z0-9_-]+)\s+(.+?)\s+-\s+([^:]+?)(?::\s*(.*))?$/.exec(line);
    if (hit) {
      const summary = hit[4]?.trim();
      tasks.push({
        id: hit[1],
        name: hit[2].trim(),
        state: hit[3].trim().toLowerCase(),
        ...(summary ? { summary } : {}),
      });
    }
  }

  return tasks.length > 0 ? tasks : null;
}

/** The dot's colour follows the state: answered = ok, waiting/stalled = warn, failed/could not be sent = danger. */
export function noticeTone(state: string): 'ok' | 'warn' | 'danger' {
  const s = state.trim().toLowerCase();
  if (s.includes('answer')) return 'ok';
  if (s.includes('wait') || s.includes('stall') || s.includes('no sign')) return 'warn';
  if (s.includes('fail') || s.includes('could not')) return 'danger';
  return 'ok';
}

export function stateLabel(state: string, lang: 'en' | 'tr' = 'en'): string {
  const s = state.trim().toLowerCase();
  if (lang === 'tr') {
    if (s === 'answered') return 'cevaplandı';
    if (s === 'waiting' || s.startsWith('wait')) return 'bekliyor';
    if (s === 'failed') return 'başarısız';
    if (s === 'stalled') return 'duraksadı';
    if (s === 'could not be sent') return 'gönderilemedi';
  }
  return state;
}
