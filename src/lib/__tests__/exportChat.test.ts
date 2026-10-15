import type { Chat } from '../../api/types';
import { chatToHtml, chatToMarkdown, exportName } from '../exportChat';

const chat: Chat = {
  id: 'c1',
  title: 'Rail sag / 3.3 V?',
  provider: 'openrouter',
  model: 'anthropic/claude-sonnet-4.5',
  created_at: '2026-10-14T09:00:00Z',
  updated_at: '2026-10-14T09:05:00Z',
  count: 2,
  messages: [
    { id: 'm1', role: 'user', content: 'Why <does> it sag?', at: '2026-10-14T09:01:00Z', by: { name: 'Ada' } },
    {
      id: 'm2',
      role: 'assistant',
      content: '## Cause\n\nThe **bead**.\n\n```\nBLM18\n```',
      at: '2026-10-14T09:02:00Z',
      model: 'anthropic/claude-sonnet-4.5',
    },
    { id: 'm3', role: 'assistant', content: '', at: '2026-10-14T09:03:00Z', stopped: true },
  ],
};

describe('exporting a conversation', () => {
  it('writes Markdown with who said what and when', () => {
    const md = chatToMarkdown(chat);
    expect(md.startsWith('# Rail sag / 3.3 V?\n')).toBe(true);
    expect(md).toContain('## Ada · ');
    expect(md).toContain('## claude-sonnet-4.5 · ');
    expect(md).toContain('The **bead**.');
    expect(md).toContain('(stopped)');
  });

  it('writes a printable page with the answers laid out and everything escaped', () => {
    const html = chatToHtml(chat);
    expect(html).toContain('<h1>Rail sag / 3.3 V?</h1>');
    expect(html).toContain('Why &lt;does&gt; it sag?');
    expect(html).toContain('<strong>bead</strong>');
    expect(html).toContain('<pre>BLM18</pre>');
    expect(html).not.toContain('<does>');
  });

  it('names the file after the title', () => {
    expect(exportName(chat, 'md')).toBe('Rail sag 33 V.md');
    expect(exportName({ title: '' }, 'pdf')).toBe('Conversation.pdf');
  });
});
