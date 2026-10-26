/**
 * The Chat's detail setting (lib/chatDetail.ts): the three stops, the counts
 * and spells an answer's folded line is written with, and the same words in
 * Turkish. It is the web app's chat-detail.ts, so the two say the same thing.
 */
import {
  activityWords,
  chatDetailStrings,
  chars,
  DETAIL_STOPS,
  detailAt,
  detailIndex,
  secsOf,
} from '../chatDetail';

const en = chatDetailStrings('en');
const tr = chatDetailStrings('tr');

describe("the Chat's detail setting", () => {
  it('runs from compact to detailed, and a stop that is not one stays at an end', () => {
    expect(DETAIL_STOPS).toEqual(['compact', 'normal', 'detailed']);
    expect(detailIndex('compact')).toBe(0);
    expect(detailIndex('normal')).toBe(1);
    expect(detailIndex('detailed')).toBe(2);
    expect(detailIndex('something else' as never)).toBe(0);
    expect(detailAt(0)).toBe('compact');
    expect(detailAt(2)).toBe('detailed');
    expect(detailAt(-4)).toBe('compact');
    expect(detailAt(9)).toBe('detailed');
  });

  it('writes counts of characters and spells the way the Chat does', () => {
    expect(chars(940)).toBe('940');
    expect(chars(1000)).toBe('1k');
    expect(chars(4200)).toBe('4.2k');
    expect(chars(1_100_000)).toBe('1.1M');
    expect(secsOf(8900)).toBe('8.9 s');
    expect(secsOf(41_000)).toBe('41 s');
  });

  it('says what a folded answer did: the tools, and how long it thought', () => {
    expect(activityWords(4, 900, 8900, en.act)).toBe('4 tool calls · thought 8.9 s');
    expect(activityWords(1, 0, null, en.act)).toBe('1 tool call');
    expect(activityWords(0, 4200, null, en.act)).toBe('thinking 4.2k chars');
    // How long it thought, when that is too short to say, gives way to how much it wrote.
    expect(activityWords(3, 4200, 300, en.act)).toBe('3 tool calls · thinking 4.2k chars');
    expect(activityWords(0, 0, null, en.act)).toBe('what it did');
  });

  it('says the same in Turkish', () => {
    expect(activityWords(4, 900, 8900, tr.act)).toBe('4 araç çağrısı · düşündü 8.9 s');
    expect(activityWords(1, 0, null, tr.act)).toBe('1 araç çağrısı');
    expect(activityWords(0, 4200, null, tr.act)).toBe('düşünme 4.2k karakter');
  });

  it('offers the three stops, each with its own sentence, in both languages', () => {
    expect(en.title).toBe('Chat detail');
    expect(tr.title).toBe('Sohbet ayrıntısı');
    expect(en.levels.map((l) => l.label)).toEqual(['Compact', 'Normal', 'Detailed']);
    expect(tr.levels.map((l) => l.label)).toEqual(['Sıkı', 'Normal', 'Ayrıntılı']);
    expect(en.levels.map((l) => l.id)).toEqual(DETAIL_STOPS);
    expect(tr.levels.map((l) => l.id)).toEqual(DETAIL_STOPS);
    // Every stop says what it means, in both.
    for (const s of [en, tr]) for (const l of s.levels) expect(l.about.length).toBeGreaterThan(20);
  });

  it('shows what the setting looks like: one answer line, as compact writes it', () => {
    const line = activityWords(12, 4200, null, en.act);
    expect(en.sample(line)).toBe('In compact an answer says what was done: 12 tool calls · thinking 4.2k chars');
    expect(tr.sample('12 araç çağrısı')).toContain('12 araç çağrısı');
  });

  it('words the thinking row and the folded tools row', () => {
    expect(en.thinking).toEqual({ live: 'Thinking…', done: 'Thought it through' });
    expect(en.ran(4, 0)).toBe('Ran 4 tools');
    expect(en.ran(4, 1)).toBe('Ran 4 tools, 1 failed');
    expect(tr.ran(2, 0)).toBe('2 araç çalıştırdı');
  });
});
