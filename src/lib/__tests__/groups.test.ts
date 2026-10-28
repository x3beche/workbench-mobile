import type { Chat } from '../../api/types';
import { chatSnippet, filterChats, greeting, groupChats, groupOf, initials, rowTime } from '../groups';

// A Wednesday afternoon, in the test machine's own time zone.
const NOW = new Date(2026, 9, 14, 15, 30, 0);
const at = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const chat = (id: string, updated_at: string, extra: Partial<Chat> = {}): Chat =>
  ({
    id,
    title: `Chat ${id}`,
    provider: 'p',
    model: 'm',
    created_at: updated_at,
    updated_at,
    count: 1,
    ...extra,
  }) as Chat;

describe('groupChats', () => {
  const chats = [
    chat('older', at(1)),
    chat('today-early', at(14, 0, 5)),
    chat('yesterday', at(13, 23, 59)),
    chat('week', at(8)),
    chat('today-late', at(14, 15)),
    chat('eight-days', at(6, 23)),
    chat('pinned-old', at(1), { pinned: true }),
  ];

  it('puts pinned first, then Today, Yesterday, Previous 7 days and Older, newest first in each', () => {
    const groups = groupChats(chats, NOW);
    expect(groups.map((g) => [g.name, g.chats.map((c) => c.id)])).toEqual([
      ['Pinned', ['pinned-old']],
      ['Today', ['today-late', 'today-early']],
      ['Yesterday', ['yesterday']],
      ['Previous 7 days', ['week']],
      ['Older', ['eight-days', 'older']],
    ]);
  });

  it('leaves empty groups out', () => {
    expect(groupChats([chat('a', at(14, 9))], NOW).map((g) => g.name)).toEqual(['Today']);
    expect(groupChats([], NOW)).toEqual([]);
  });

  it('counts calendar days, not 24-hour spans', () => {
    // Five minutes after midnight is today; a minute before is yesterday.
    expect(groupOf(chat('a', at(14, 0, 5)), NOW)).toBe('Today');
    expect(groupOf(chat('b', at(13, 23, 59)), NOW)).toBe('Yesterday');
    expect(groupOf(chat('c', at(7, 0, 1)), NOW)).toBe('Previous 7 days');
    expect(groupOf(chat('d', at(6, 23, 59)), NOW)).toBe('Older');
  });

  it('takes a missing or broken time as long ago', () => {
    expect(groupOf(chat('x', 'not a date'), NOW)).toBe('Older');
  });
});

describe('rowTime', () => {
  it('says how long ago today, the clock yesterday, the day this week, the date before', () => {
    expect(rowTime(chat('a', new Date(NOW.getTime() - 12 * 60_000).toISOString()), 'Today', NOW)).toBe(
      '12 min ago',
    );
    expect(rowTime(chat('e', new Date(NOW.getTime() - 3 * 3600_000).toISOString()), 'Today', NOW)).toBe(
      '3 h ago',
    );
    expect(rowTime(chat('b', at(13, 9, 5)), 'Yesterday', NOW)).toBe('09:05');
    expect(rowTime(chat('c', at(12)), 'Previous 7 days', NOW)).toBe('Mon');
    expect(rowTime(chat('d', at(1)), 'Older', NOW)).toBe('1 Oct');
  });
});

describe('chatSnippet', () => {
  it('gives who wrote last and what, without its Markdown, and says when nothing was written', () => {
    expect(chatSnippet(chat('a', at(14), { last: { role: 'assistant', text: '  Two\n\nwalls ' } }))).toBe(
      'Two walls',
    );
    expect(
      chatSnippet(chat('b', at(14), { last: { role: 'user', text: 'Move it left', by: 'Ada' } })),
    ).toBe('Ada: Move it left');
    // The list's line is the words, not the markup they were written in.
    expect(chatSnippet(chat('c', at(14), { last: { role: 'assistant', text: '## Why\n\n`R6` is enough' } }))).toBe(
      'Why R6 is enough',
    );
    expect(chatSnippet(chat('d', at(14)))).toBe('No messages yet');
  });
});

describe('filterChats', () => {
  const chats = [
    chat('1', at(14), { title: 'Rail sag on the sensor board' }),
    chat('2', at(14), { title: 'Enclosure', last: { role: 'assistant', text: 'PETG walls of 1.6 mm' } }),
  ];
  it('keeps the ones with every word, in the title or the last line, ignoring case', () => {
    expect(filterChats(chats, 'sensor RAIL').map((c) => c.id)).toEqual(['1']);
    expect(filterChats(chats, 'petg').map((c) => c.id)).toEqual(['2']);
    expect(filterChats(chats, 'petg rail')).toEqual([]);
    expect(filterChats(chats, '  ')).toBe(chats);
  });
});

describe('greeting and initials', () => {
  it.each([
    [7, 'Good morning'],
    [12, 'Good afternoon'],
    [19, 'Good evening'],
    [2, 'Good evening'],
  ])('%i h -> %s', (h, want) => {
    expect(greeting(new Date(2026, 9, 14, h))).toBe(want);
  });

  it.each([
    ['Ada Demir', 'AD'],
    ['Ada Lovelace Byron', 'AB'],
    ['ada', 'A'],
    ['kerem.yilmaz@example.com', 'KY'],
    ['', '?'],
    [null, '?'],
  ])('%s -> %s', (name, want) => {
    expect(initials(name)).toBe(want);
  });
});
