import { heightOf, linkMap, managersOf, treeOf, whyNot } from '../agents';

const map = linkMap([
  { worker: 'wbo:b', manager: 'wbc:a' },
  { worker: 'wbo:c', manager: 'wbc:a' },
  { worker: 'wbo:d', manager: 'wbo:c' },
  { worker: 'wbo:x', manager: null },
]);

describe('agents: who manages whom', () => {
  it('reads the links, leaving out the ones on their own', () => {
    expect([...map.entries()]).toEqual([['wbo:b', 'wbc:a'], ['wbo:c', 'wbc:a'], ['wbo:d', 'wbo:c']]);
  });

  it('walks up and measures down', () => {
    expect(managersOf(map, 'wbo:d', 3)).toEqual(['wbo:c', 'wbc:a']);
    expect(heightOf(map, 'wbc:a', 3)).toBe(2);
    expect(heightOf(map, 'wbo:b', 3)).toBe(0);
  });

  it('refuses itself, a circle and a fourth level, as the server does', () => {
    expect(whyNot(map, 'wbo:b', 'wbo:b', 3)).toBe('self');
    expect(whyNot(map, 'wbc:a', 'wbo:d', 3)).toBe('circle');
    expect(whyNot(map, 'wbo:x', 'wbo:d', 3)).toBe('deep');
    expect(whyNot(map, 'wbo:x', 'wbo:b', 3)).toBeNull();
    expect(whyNot(map, 'wbo:c', 'wbo:b', 3)).toBe('deep'); // c carries d: a > b > c > d
  });

  it('ends on a loop in the data', () => {
    const loop = linkMap([{ worker: 'p', manager: 'q' }, { worker: 'q', manager: 'p' }]);
    expect(managersOf(loop, 'p', 3)).toEqual(['q']);
    expect(whyNot(loop, 'p', 'q', 3)).toBe('circle');
  });

  it('draws the tree: tops in order, each followed by the ones under it, newest first', () => {
    const rows = [
      { k: 'wbo:b', t: 5 },
      { k: 'wbc:a', t: 1 },
      { k: 'wbo:c', t: 9 },
      { k: 'wbo:d', t: 2 },
      { k: 'wbo:x', t: 7 },
    ];
    const got = treeOf(rows, (r) => r.k, (r) => r.t, map, (a, b) => b.t - a.t, 3);
    expect(got.map((x) => `${x.depth}:${x.row.k}:${x.kids}`)).toEqual([
      '0:wbo:x:0',
      '0:wbc:a:2',
      '1:wbo:c:1',
      '2:wbo:d:0',
      '1:wbo:b:0',
    ]);
  });

  it('tracks whether an item is the last child and ancestor rails passing past it', () => {
    const rows = [
      { k: 'wbo:b', t: 5 },
      { k: 'wbc:a', t: 1 },
      { k: 'wbo:c', t: 9 },
      { k: 'wbo:d', t: 2 },
      { k: 'wbo:x', t: 7 },
    ];
    const got = treeOf(rows, (r) => r.k, (r) => r.t, map, (a, b) => b.t - a.t, 3);
    expect(got.map((x) => `${x.row.k}:last=${x.last}:rails=[${x.rails.join(',')}]`)).toEqual([
      'wbo:x:last=true:rails=[]',
      'wbc:a:last=true:rails=[]',
      'wbo:c:last=false:rails=[]',
      'wbo:d:last=true:rails=[1]',
      'wbo:b:last=true:rails=[]',
    ]);
  });

  it('puts a worker whose manager is not shown at the top', () => {
    const got = treeOf([{ k: 'wbo:d', t: 1 }], (r) => r.k, (r) => r.t, map, () => 0, 3);
    expect(got.map((x) => x.depth)).toEqual([0]);
  });
});
