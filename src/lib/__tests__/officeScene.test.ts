/**
 * The Office as a picture (lib/office/scene.ts): where the furniture is, which
 * place an activity belongs to, and the short walk that gets a character there.
 * The rules are the web engine's (frontend/src/app/rooms/office/engine.ts).
 */
import type { OfficeLayout, OfficeLiveAgent } from '../../api/types';
import {
  areasOf,
  extentOf,
  floorOf,
  focusOf,
  managerTile,
  placeOf,
  sceneOf,
  seatsOf,
  walkMsFor,
  walkPoint,
  WALK_MS_MAX,
  WALK_MS_MIN,
} from '../office/scene';

const NOW = 1_700_000_000;

const LAYOUT: OfficeLayout = {
  company: { name: 'Acme', settings: {}, floors: ['f1'] },
  tile: 16,
  floors: [
    { id: 'f2', name: 'Second', order: 1, w: 10, h: 10 },
    { id: 'f1', name: 'Floor 1', order: 0, w: 24, h: 14 },
  ],
  rooms: [
    { id: 'r-dep', floor: 'f1', name: 'Jev', kind: 'department', x: 0, y: 0, w: 8, h: 5, department: { manager: 'wbo:mgr', desks: 3 } },
    { id: 'r-kit', floor: 'f1', name: 'Kitchen', kind: 'kitchen', x: 9, y: 0, w: 4, h: 4 },
    { id: 'r-lng', floor: 'f1', name: 'Lounge', kind: 'lounge', x: 14, y: 0, w: 4, h: 4 },
    { id: 'r-lob', floor: 'f1', name: 'Lobby', kind: 'lobby', x: 9, y: 5, w: 4, h: 4 },
    { id: 'r-park', floor: 'f1', name: 'Parking', kind: 'parking', x: 19, y: 0, w: 4, h: 4 },
  ],
  items: [
    { id: 'i-a', room: 'r-dep', kind: 'chair', x: 1, y: 2, dir: 0, seat_of: 'wbo:alice' },
    { id: 'i-b', room: 'r-dep', kind: 'chair', x: 3, y: 2, dir: 0, seat_of: 'wbo:bob' },
    { id: 'i-m', room: 'r-dep', kind: 'chair', x: 5, y: 2, dir: 0, seat_of: 'wbo:mgr' },
    { id: 'i-coffee', room: 'r-kit', kind: 'coffee', x: 10, y: 1, dir: 0 },
    { id: 'i-sofa', room: 'r-lng', kind: 'sofa', x: 15, y: 1, dir: 0 },
    { id: 'i-car', room: 'r-park', kind: 'car_spot', x: 20, y: 1, dir: 0 },
  ],
  seats: [
    { agent: 'wbo:alice', item: 'i-a', room: 'r-dep', floor: 'f1', auto: false },
    { agent: 'wbo:bob', item: 'i-b', room: 'r-dep', floor: 'f1', auto: false },
    { agent: 'wbo:mgr', item: 'i-m', room: 'r-dep', floor: 'f1', auto: false },
  ],
  kinds: { rooms: [], items: [] },
};

function row(over: Partial<OfficeLiveAgent> = {}): OfficeLiveAgent {
  return {
    key: 'wbo:alice', name: 'Alice', kind: 'OpenCode', state: 'working', activity: 'typing',
    bubble: '', seat: { item: 'i-a', room: 'r-dep', floor: 'f1' }, since: NOW - 10,
    manager: null, ...over,
  };
}

describe('the floor, its seats and its places', () => {
  it('opens on the first floor by order', () => {
    expect(floorOf(LAYOUT)?.id).toBe('f1');
    expect(floorOf(null)).toBeNull();
  });

  it('reads the seat of each agent from the layout, and from a chair that names one', () => {
    const seats = seatsOf(LAYOUT);
    expect(seats.get('wbo:alice')).toEqual({ x: 1, y: 2 });
    expect(seats.get('wbo:mgr')).toEqual({ x: 5, y: 2 });
    const bare = { ...LAYOUT, seats: [] };
    expect(seatsOf(bare).get('wbo:bob')).toEqual({ x: 3, y: 2 });
  });

  it('finds the car, the door, the coffee and the sofa', () => {
    const areas = areasOf(LAYOUT);
    expect(areas.car).toEqual({ x: 20, y: 1 });
    expect(areas.door).toEqual({ x: 11, y: 7 });     // the lobby's middle
    expect(areas.kitchen).toEqual({ x: 10, y: 2 });   // beside the coffee machine
    expect(areas.lounge).toEqual({ x: 15, y: 2 });    // beside the sofa
  });

  it('sends each activity to its place', () => {
    const areas = areasOf(LAYOUT);
    expect(placeOf('wbo:alice', 'typing', areas)).toEqual({ x: 1, y: 2 });
    expect(placeOf('wbo:alice', 'thinking', areas)).toEqual({ x: 1, y: 2 });
    expect(placeOf('wbo:alice', 'stuck', areas)).toEqual({ x: 1, y: 2 });
    expect(placeOf('wbo:alice', 'break', areas)).toEqual({ x: 10, y: 2 });
    expect(placeOf('wbo:alice', 'lounge', areas)).toEqual({ x: 15, y: 2 });
    expect(placeOf('wbo:alice', 'leave', areas)).toEqual({ x: 11, y: 7 });
    expect(placeOf('wbo:alice', 'arrive', areas)).toEqual({ x: 20, y: 1 });
  });

  it('sends a word to the manager beside the manager, and the manager to the middle', () => {
    const areas = areasOf(LAYOUT);
    expect(managerTile('wbo:alice', areas)).toEqual({ x: 6, y: 2 });   // right of the manager's chair
    expect(managerTile('wbo:mgr', areas)).toEqual({ x: 4, y: 2 });     // the department's middle
    expect(placeOf('wbo:alice', 'asking', areas)).toEqual({ x: 6, y: 2 });
    expect(placeOf('wbo:alice', 'meeting', areas)).toEqual({ x: 6, y: 2 });
  });

  it('still draws a floor when the office has none yet', () => {
    const areas = areasOf(null);
    expect(areas.floor).toEqual({ id: 'floor', name: 'Floor', w: 24, h: 14 });
    expect(areas.car).toEqual({ x: 2, y: 2 });
    expect(areas.seats.size).toBe(0);
  });
});

describe('the walk', () => {
  it('is shortest for one tile and longest for ten', () => {
    expect(walkMsFor({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(WALK_MS_MIN);
    expect(walkMsFor({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(WALK_MS_MIN);
    expect(walkMsFor({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(WALK_MS_MAX);
    expect(walkMsFor({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(480);
  });

  it('eases from one tile to another, and is not walking off the line', () => {
    const start = walkPoint({ x: 0, y: 0 }, { x: 4, y: 0 }, 0);
    const end = walkPoint({ x: 0, y: 0 }, { x: 4, y: 0 }, 1);
    const half = walkPoint({ x: 0, y: 0 }, { x: 4, y: 0 }, 0.5);
    expect(start).toEqual({ x: 8, y: 8 });
    expect(end).toEqual({ x: 72, y: 8 });
    // Eased out: past the middle of the line half-way through the time.
    expect(half.x).toBeGreaterThan((8 + 72) / 2);
    expect(half.y).toBe(8);
  });
});

describe('the picture', () => {
  it('puts a typist at its seat, still, facing the room', () => {
    const scene = sceneOf(LAYOUT, [row()], NOW);
    expect(scene.floor?.w).toBe(24);
    expect(scene.rooms).toHaveLength(5);
    expect(scene.items).toHaveLength(6);
    const p = scene.people[0];
    expect(p).toMatchObject({ key: 'wbo:alice', activity: 'typing', pose: 'type', walking: false, x: 24, y: 40 });
  });

  it('walks a coffee break from the seat to the kitchen, then stands there with a cup', () => {
    const onTheWay = sceneOf(LAYOUT, [row({ activity: 'break', since: NOW - 0.1 })], NOW).people[0];
    expect(onTheWay.walking).toBe(true);
    expect(onTheWay.pose).toBe('walk');
    expect(onTheWay.dir).toBe('e');
    expect(onTheWay.x).toBeGreaterThan(24);
    expect(onTheWay.x).toBeLessThan(168);

    const there = sceneOf(LAYOUT, [row({ activity: 'break', since: NOW - 10 })], NOW).people[0];
    expect(there).toMatchObject({ walking: false, pose: 'cup', x: 168, y: 40 });
  });

  it('drives an arriving agent in from the car spot', () => {
    const p = sceneOf(LAYOUT, [row({ activity: 'arrive', since: NOW - 0.2 })], NOW).people[0];
    expect(p.walking).toBe(true);
    expect(p.x).toBeGreaterThan(100);        // out by the car park, not at the desk yet
    expect(p.dir).toBe('w');

    const arrived = sceneOf(LAYOUT, [row({ activity: 'arrive', since: NOW - 30 })], NOW).people[0];
    expect(arrived.walking).toBe(false);
    expect(arrived).toMatchObject({ x: 24, y: 40 });
  });

  it('treats an unknown since as done walking, and a missing seat as the car park', () => {
    const p = sceneOf(LAYOUT, [row({ since: 0 })], NOW).people[0];
    expect(p.walking).toBe(false);
    const unseated = sceneOf(LAYOUT, [row({ key: 'wbo:new', name: 'New', since: 0 })], NOW).people[0];
    expect(unseated).toMatchObject({ x: 328, y: 24, walking: false });  // no seat: the car park
  });

  it('keeps the state, the task and the bubble on the row', () => {
    const p = sceneOf(LAYOUT, [row({
      state: 'waiting', activity: 'asking', bubble: 'waiting for you',
      task: { id: 't1', title: 'Ship it', status: 'working', progress: 40 },
    })], NOW).people[0];
    expect(p).toMatchObject({
      state: 'waiting', tone: 'ask', bubble: 'waiting for you',
      task: { id: 't1', title: 'Ship it', status: 'working', progress: 40 },
    });
  });

  it('draws the lower character over the higher, and reads a roomless office as empty', () => {
    const scene = sceneOf(LAYOUT, [
      row({ key: 'wbo:alice', name: 'Alice', activity: 'break', since: NOW - 10 }),
      row({ key: 'wbo:bob', name: 'Bob', activity: 'typing', since: NOW - 10, seat: { item: 'i-b', room: 'r-dep', floor: 'f1' } }),
    ], NOW);
    // The kitchen is one row below the desks (y=2 vs y=2: same row; Alice is right of Bob and sorts after).
    expect(scene.people.map((p) => p.name)).toEqual(['Bob', 'Alice']);
    const bare = sceneOf(null, [], NOW);
    expect(bare.people).toEqual([]);
    expect(bare.rooms).toEqual([]);
    expect(extentOf(bare)).toEqual({ w: 24, h: 14 });
    expect(focusOf(bare)).toEqual({ x: 192, y: 112 });

    // A company wider than a phone opens on its people, or (without any) on the first department.
    const busy = sceneOf(LAYOUT, [row({ activity: 'break', since: NOW - 10 }), row({ key: 'wbo:bob', name: 'Bob' })], NOW);
    expect(focusOf(busy)).toEqual({ x: (168 + 56) / 2, y: 40 });
    const noOne = sceneOf(LAYOUT, [], NOW);
    expect(focusOf(noOne)).toEqual({ x: 4 * 16, y: 2.5 * 16 });
  });
});
