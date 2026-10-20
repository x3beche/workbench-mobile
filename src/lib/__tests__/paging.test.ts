/** A room read ten lines at a time: the newest page laid over what is held, older pages put before it. */
import { layLatest, putOlder } from '../paging';

const L = (...ids: number[]) => ids.map((i) => ({ id: `l${i}`, text: `line ${i}` }));
const ids = (ls: { id: string }[]) => ls.map((l) => Number(l.id.slice(1)));
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

describe('the newest page', () => {
  it('is all there is at first', () => {
    expect(layLatest(null, L(1, 2))).toEqual({ lines: L(1, 2), gap: false });
  });

  it('keeps the older pages held and takes the newest from the server', () => {
    const held = L(...range(0, 20));
    const got = layLatest(held, L(...range(12, 22)));
    expect(ids(got.lines)).toEqual(range(0, 22));
    expect(got.gap).toBe(false);
  });

  it('replaces a line read again (now seen)', () => {
    const held = L(1, 2, 3);
    const again = [{ id: 'l2', text: 'seen' }, { id: 'l3', text: 'line 3' }];
    expect(layLatest(held, again).lines[1].text).toBe('seen');
  });

  it('says when more came than a page holds, and keeps only the page', () => {
    const got = layLatest(L(...range(0, 10)), L(...range(30, 40)));
    expect(got.gap).toBe(true);
    expect(ids(got.lines)).toEqual(range(30, 40));
  });

  it('a short page is the whole thread', () => {
    expect(layLatest(L(5, 6), L(7)).lines).toEqual(L(7));
  });
});

describe('an older page', () => {
  it('goes before what is held, without the lines already there', () => {
    const got = putOlder(L(10, 11), L(8, 9, 10));
    expect(ids(got.lines)).toEqual([8, 9, 10, 11]);
    expect(got.added).toBe(2);
  });

  it('brings nothing from a server that does not page back', () => {
    const held = L(10, 11);
    expect(putOlder(held, L(10, 11))).toEqual({ lines: held, added: 0 });
  });
});
