import { noticeTone, parseNotice, stateLabel } from '../notice';

describe('Workbench notification parser', () => {
  it('parses a single task with summary and hyphens/dots in name', () => {
    const text =
      '[Workbench] #676936 MOBIL-PANEL-YAMA-1.9.27 - answered: answer summary here\n(task_status 676936 for the whole answer; task_close when it is done)';
    const got = parseNotice(text);
    expect(got).toEqual([
      {
        id: '676936',
        name: 'MOBIL-PANEL-YAMA-1.9.27',
        state: 'answered',
        summary: 'answer summary here',
      },
    ]);
  });

  it('parses multiple tasks in a single message', () => {
    const text = [
      '[Workbench] #196b29 OPENCODE-CTX-LIMIT - answered',
      '#676936 MOBIL-PANEL-YAMA-1.9.27 - answered: built and signed',
      '(task_status <id> for the whole answer; task_close when it is done)',
    ].join('\n');
    const got = parseNotice(text);
    expect(got).toEqual([
      {
        id: '196b29',
        name: 'OPENCODE-CTX-LIMIT',
        state: 'answered',
      },
      {
        id: '676936',
        name: 'MOBIL-PANEL-YAMA-1.9.27',
        state: 'answered',
        summary: 'built and signed',
      },
    ]);
  });

  it('parses failed, stalled, waiting and could not be sent states', () => {
    const text = [
      '[Workbench]',
      '#a1 TASK-A - waiting',
      '#b2 TASK-B - stalled: no sign for 15 min',
      '#c3 TASK-C - failed: exit 1',
      '#d4 TASK-D - could not be sent: the computer is offline',
    ].join('\n');
    const got = parseNotice(text);
    expect(got).toHaveLength(4);
    expect(got![0].state).toBe('waiting');
    expect(got![1].state).toBe('stalled');
    expect(got![2].state).toBe('failed');
    expect(got![3].state).toBe('could not be sent');
  });

  it('drops the trailing task_status line', () => {
    const text = '[Workbench] #123 T1 - answered\n(task_status 123)';
    const got = parseNotice(text);
    expect(got).toHaveLength(1);
    expect(got![0].id).toBe('123');
  });

  it('returns null when text is not a Workbench notification', () => {
    expect(parseNotice('Hello there!')).toBeNull();
    expect(parseNotice('#123 not a workbench prefix')).toBeNull();
    expect(parseNotice('[Workbench] no tasks here')).toBeNull();
    expect(parseNotice('')).toBeNull();
  });

  it('knows the server’s mark without the prefix', () => {
    // what the Workbench stores as kind: "notify" (backend/wbclaude.py): a notification, prefix or none
    const text = '#123 T1 - answered: done\n(task_status 123)';
    expect(parseNotice(text)).toBeNull();
    expect(parseNotice(text, 'notify')).toEqual([
      { id: '123', name: 'T1', state: 'answered', summary: 'done' },
    ]);
  });

  it('still knows the prefix without a mark, for the lines written before it', () => {
    expect(parseNotice('[Workbench] #1 T - waiting')).toEqual([{ id: '1', name: 'T', state: 'waiting' }]);
  });

  it('leaves an ordinary message alone, marked or not', () => {
    expect(parseNotice('#1 T - waiting', 'chat')).toBeNull();
    expect(parseNotice('Can you look at the rig?', 'notify')).toBeNull();
    expect(parseNotice('Can you look at the rig?')).toBeNull();
  });

  it('maps state to correct tone', () => {
    expect(noticeTone('answered')).toBe('ok');
    expect(noticeTone('waiting')).toBe('warn');
    expect(noticeTone('stalled')).toBe('warn');
    expect(noticeTone('failed')).toBe('danger');
    expect(noticeTone('could not be sent')).toBe('danger');
  });

  it('translates state labels in Turkish', () => {
    expect(stateLabel('answered', 'tr')).toBe('cevaplandı');
    expect(stateLabel('waiting', 'tr')).toBe('bekliyor');
    expect(stateLabel('failed', 'tr')).toBe('başarısız');
    expect(stateLabel('stalled', 'tr')).toBe('duraksadı');
    expect(stateLabel('could not be sent', 'tr')).toBe('gönderilemedi');
    expect(stateLabel('answered', 'en')).toBe('answered');
  });
});
