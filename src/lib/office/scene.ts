/**
 * The Office as a picture: which room is drawn, where the furniture stands,
 * and where every character is at `now` (docs/OFFICE.md, phases 1-2).
 *
 * A pure function of the layout and the live rows, the same rules the web's
 * engine keeps (`frontend/src/app/rooms/office/engine.ts`):
 *
 *   seat      the agent's own chair
 *   kitchen   a tile beside the first coffee machine
 *   lounge    a tile beside the first sofa
 *   door      the lobby's middle (the car park when there is no lobby)
 *   car       the first car spot
 *   manager   the chair beside the manager's, in the department the agent sits
 *             in (the department's middle when that manager has no chair)
 *
 * A walk is not state: the server says when an activity began (`since`), so a
 * character's place on the way to the kitchen / the manager / the door / its
 * seat is a tween of that time. After the walk it stands at the place, and the
 * view only redraws while something actually walks.
 */
import type { OfficeFloor, OfficeItem, OfficeLayout, OfficeLiveAgent, OfficeRoom, OfficeTask } from '../../api/types';
import { activityOf, bubbleTone, faceOf, lookOf, type Activity, type Dir, type Pose } from './anim';
import { TILE, tileCentre, tileSteps, type Point } from './grid';

/** A walk's shortest and longest, in ms, and how long one tile adds. */
export const WALK_MS_MIN = 450;
export const WALK_MS_MAX = 1600;
export const WALK_MS_PER_TILE = 160;

export interface SceneFloor {
  id: string;
  name: string;
  w: number;
  h: number;
}

export interface SceneRoom {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The manager of a department room, when it has one. */
  manager: string | null;
}

export interface SceneItem {
  id: string;
  kind: string;
  x: number;
  y: number;
  dir: number;
}

export interface ScenePerson {
  key: string;
  name: string;
  kind: string;
  state: string;
  activity: Activity;
  bubble: string | null;
  tone: 'info' | 'ask' | 'alert';
  task: OfficeTask | null;
  /** The middle of the tile the character stands on, in world pixels (its feet). */
  x: number;
  y: number;
  dir: Dir;
  pose: Pose;
  /** On the way somewhere: the view steps the legs and the screen keeps ticking. */
  walking: boolean;
}

export interface Scene {
  floor: SceneFloor | null;
  rooms: SceneRoom[];
  items: SceneItem[];
  people: ScenePerson[];
}

/** The fixed places of a floor, read once from the layout. */
export interface Areas {
  floor: SceneFloor | null;
  rooms: SceneRoom[];
  items: SceneItem[];
  seats: Map<string, Point>;
  car: Point;
  door: Point;
  kitchen: Point | null;
  lounge: Point | null;
}

const DEFAULT_FLOOR: SceneFloor = { id: 'floor', name: 'Floor', w: 24, h: 14 };
const DEFAULT_CAR: Point = { x: 2, y: 2 };

/** The floor the office opens on: the first by order, or a 24×14 room when the layout has none yet. */
export function floorOf(layout: OfficeLayout | null): OfficeFloor | null {
  if (!layout?.floors?.length) return null;
  return [...layout.floors].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null;
}

/** The agent → tile seats, from the layout's seats and the items they name. */
export function seatsOf(layout: OfficeLayout | null): Map<string, Point> {
  const seats = new Map<string, Point>();
  if (!layout) return seats;
  const items = new Map((layout.items ?? []).map((it) => [it.id, it]));
  for (const s of layout.seats ?? []) {
    const item = items.get(s.item);
    if (item) seats.set(s.agent, { x: item.x, y: item.y });
  }
  // An item that names its agent (seat_of) is a seat even when the seats list missed it.
  for (const it of layout.items ?? []) {
    if (it.seat_of && !seats.has(it.seat_of)) seats.set(it.seat_of, { x: it.x, y: it.y });
  }
  return seats;
}

/** Everything still about the floor: its rooms, its furniture, and the places characters go to. */
export function areasOf(layout: OfficeLayout | null): Areas {
  const floor = floorOf(layout);
  const sf: SceneFloor = floor
    ? { id: floor.id, name: floor.name, w: Math.max(1, floor.w), h: Math.max(1, floor.h) }
    : DEFAULT_FLOOR;
  const rooms: SceneRoom[] = (layout?.rooms ?? [])
    .filter((r: OfficeRoom) => !floor || r.floor === floor.id)
    .map((r) => ({
      id: r.id, name: r.name, kind: r.kind, x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h),
      manager: r.department?.manager || null,
    }));
  const byRoom = new Set(rooms.map((r) => r.id));
  const items: SceneItem[] = (layout?.items ?? [])
    .filter((it: OfficeItem) => byRoom.has(it.room))
    .map((it) => ({ id: it.id, kind: it.kind, x: it.x, y: it.y, dir: it.dir ?? 0 }));

  const seatMap = seatsOf(layout);
  const car = firstItem(items, 'car_spot') ?? roomCentre(rooms, 'parking') ?? DEFAULT_CAR;
  const door = roomCentre(rooms, 'lobby') ?? car;
  const kitchen = beside(items, rooms, 'coffee') ?? roomCentre(rooms, 'kitchen');
  const lounge = beside(items, rooms, 'sofa') ?? roomCentre(rooms, 'lounge');
  return { floor: sf, rooms, items, seats: seatMap, car, door, kitchen, lounge };
}

function firstItem(items: SceneItem[], kind: string): Point | null {
  const it = items.find((i) => i.kind === kind);
  return it ? { x: it.x, y: it.y } : null;
}

/** A tile beside the first item of a kind that is on the floor (below, right, left, above: the walk-up side
 *  first, as the web's engine has it). */
function beside(items: SceneItem[], rooms: SceneRoom[], kind: string): Point | null {
  const it = items.find((i) => i.kind === kind);
  if (!it) return null;
  const w = Math.max(...rooms.map((r) => r.x + r.w), it.x + 2);
  const h = Math.max(...rooms.map((r) => r.y + r.h), it.y + 2);
  for (const d of [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
    const q = { x: it.x + d.x, y: it.y + d.y };
    if (q.x >= 0 && q.y >= 0 && q.x < w && q.y < h) return q;
  }
  return { x: it.x, y: it.y };
}

function roomCentre(rooms: SceneRoom[], kind: string): Point | null {
  const room = rooms.find((r) => r.kind === kind);
  if (!room) return null;
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

function roomAt(rooms: SceneRoom[], p: Point): SceneRoom | null {
  return rooms.find((r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h) ?? null;
}

/** The tile beside the manager's chair for the department the agent sits in; its own seat when it is that
 *  manager or no chair is known; the department's middle when there is no manager's chair at all. */
export function managerTile(key: string, areas: Areas): Point | null {
  const seat = areas.seats.get(key) ?? null;
  const here = seat ? roomAt(areas.rooms, seat) : null;
  const manager = here?.manager && here.manager !== key ? here.manager : null;
  const target = manager ? areas.seats.get(manager) ?? null : null;
  if (target) {
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }]) {
      const q = { x: target.x + d.x, y: target.y + d.y };
      if (q.x >= 0 && q.y >= 0 && q.x < (areas.floor?.w ?? 24) && q.y < (areas.floor?.h ?? 14)) return q;
    }
    return target;
  }
  return roomCentre(areas.rooms, 'department') ?? seat;
}

/** Where an activity happens, in tiles (the web engine's `placeTile`). Null when nothing is known. */
export function placeOf(key: string, activity: Activity, areas: Areas): Point | null {
  const place = lookOf(activity).place;
  if (place === 'car') return areas.car;
  if (place === 'door') return areas.door;
  if (place === 'kitchen') return areas.kitchen;
  if (place === 'lounge') return areas.lounge;
  if (place === 'manager') return managerTile(key, areas);
  return areas.seats.get(key) ?? null;
}

/** How long the walk from one tile to another takes on the phone's ground. */
export function walkMsFor(from: Point, to: Point): number {
  const steps = tileSteps(from, to);
  return Math.min(WALK_MS_MAX, Math.max(WALK_MS_MIN, steps * WALK_MS_PER_TILE));
}

/** A tile's middle in world pixels; a point already in world pixels is passed through by the caller. */
function centre(p: Point): Point {
  return tileCentre(p);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function clamp01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** The walk: from one tile to another, eased, and whether it is still under way at `progress` (0..1). */
export function walkPoint(from: Point, to: Point, progress: number): Point {
  const t = clamp01(progress);
  const eased = t * (2 - t);
  return centre(lerp(from, to, eased));
}

/**
 * The whole picture at `nowS` (the server's clock, in seconds: the rows' `since` is on it).
 * Pure; calling it twice with the same arguments gives the same picture, so a test can read it.
 */
export function sceneOf(layout: OfficeLayout | null, live: OfficeLiveAgent[] | null, nowS: number): Scene {
  const areas = areasOf(layout);
  const people: ScenePerson[] = [];
  for (const row of live ?? []) {
    const activity = activityOf(row.activity);
    const look = lookOf(activity);
    const seat = areas.seats.get(row.key) ?? null;
    const target = placeOf(row.key, activity, areas) ?? seat ?? areas.car;
    const from = activity === 'arrive' ? areas.car : seat ?? areas.car;
    const to = activity === 'arrive' ? seat ?? target : target;
    const ms = walkMsFor(from, to);
    const began = typeof row.since === 'number' && row.since > 0 ? row.since : -Infinity;
    const progress = began === -Infinity ? 1 : clamp01(((nowS - began) * 1000) / ms);
    const walking = progress < 1 && (from.x !== to.x || from.y !== to.y);
    const p = walking ? walkPoint(from, to, progress) : centre(to);
    const face = faceOf(to.x - from.x, to.y - from.y);
    people.push({
      key: row.key,
      name: row.name,
      kind: row.kind,
      state: row.state,
      activity,
      bubble: row.bubble || null,
      tone: bubbleTone(activity),
      task: row.task ?? null,
      x: p.x,
      y: p.y,
      dir: walking ? face : faceAtSeat(activity, face),
      pose: walking ? 'walk' : look.pose,
      walking,
    });
  }
  people.sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.name.localeCompare(b.name));
  return { floor: areas.floor, rooms: areas.rooms, items: areas.items, people };
}

/** A standing character faces the room the way it sat (the desk faces south in the placeholder art). */
function faceAtSeat(activity: Activity, fallback: Dir): Dir {
  if (activity === 'leave') return 's';
  if (activity === 'break') return fallback;
  return fallback;
}

/** A rough bounding box of the built office, in tiles: the furthest room edge, or the floor's own size. */
export function extentOf(scene: Pick<Scene, 'floor' | 'rooms'>): { w: number; h: number } {
  const w = Math.max(scene.floor?.w ?? 0, ...scene.rooms.map((r) => r.x + r.w), DEFAULT_FLOOR.w);
  const h = Math.max(scene.floor?.h ?? 0, ...scene.rooms.map((r) => r.y + r.h), DEFAULT_FLOOR.h);
  return { w, h };
}

/**
 * Where the camera should look when the floor is wider than the phone can show: the agents themselves (the
 * middle of them), else the first department room, else the floor's middle. A 52-tile company does not fit at
 * ×1; opening on its lobby would show an empty corner while every agent sits off-screen.
 */
export function focusOf(scene: Pick<Scene, 'floor' | 'rooms' | 'people'>): Point {
  if (scene.people.length) {
    let x = 0;
    let y = 0;
    for (const p of scene.people) {
      x += p.x;
      y += p.y;
    }
    return { x: x / scene.people.length, y: y / scene.people.length };
  }
  const dept = scene.rooms.find((r) => r.kind === 'department') ?? scene.rooms[0];
  if (dept) return { x: (dept.x + dept.w / 2) * TILE, y: (dept.y + dept.h / 2) * TILE };
  return { x: ((scene.floor?.w ?? 24) * TILE) / 2, y: ((scene.floor?.h ?? 14) * TILE) / 2 };
}

/** World pixels of a tile, for the view's absolute placement. */
export function px(p: Point): Point {
  return { x: p.x * TILE, y: p.y * TILE };
}
