/**
 * The Office's cars: a colour that is always the same for a name, the way in from the yard's edge to a parking
 * spot, and the drive itself - the web's `frontend/src/app/rooms/office/cars.ts` and its engine's car tween.
 *
 * A car is the person's: the same agent always drives the same colour, and the car enters from the floor edge
 * nearest its parking room (from the top in the default company, where the car park sits on the top row).
 */
import { TILE, type Point } from './grid';

/** How long a car takes in or out, in ms (the web's `CAR_IN_MS` and `CAR_OUT_MS`). */
export const CAR_IN_MS = 1400;
export const CAR_OUT_MS = 900;

/** A stable hue from a name: the same agent always parks the same coloured car. */
export function carHue(name: string): number {
  let h = 2166136261;
  for (const ch of name) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

export interface CarEntry {
  /** Where the car comes from, in world pixels (just outside the floor). */
  x: number;
  y: number;
  /** A car entering from the top or bottom drives nose-up: its sprite is drawn tall, not wide. */
  vertical: boolean;
}

/** The floor edge nearest the parking room, aligned with the spot: the car comes in from the yard there. */
export function carEntry(
  floorW: number, floorH: number, spot: Point,
  room?: { x: number; y: number; w: number; h: number } | null,
): CarEntry {
  const sx = spot.x * TILE + TILE / 2;
  const sy = spot.y * TILE + TILE / 2;
  const gaps = room
    ? [
        { edge: 'top' as const, d: room.y },
        { edge: 'left' as const, d: room.x },
        { edge: 'right' as const, d: floorW - (room.x + room.w) },
        { edge: 'bottom' as const, d: floorH - (room.y + room.h) },
      ]
    : [
        { edge: 'top' as const, d: spot.y },
        { edge: 'left' as const, d: spot.x },
        { edge: 'right' as const, d: floorW - spot.x },
        { edge: 'bottom' as const, d: floorH - spot.y },
      ];
  let near = gaps[0];
  for (const g of gaps) if (g.d < near.d) near = g;
  const margin = 24;
  if (near.edge === 'top') return { x: sx, y: -margin, vertical: true };
  if (near.edge === 'bottom') return { x: sx, y: floorH * TILE + margin, vertical: true };
  if (near.edge === 'left') return { x: -margin, y: sy, vertical: false };
  return { x: floorW * TILE + margin, y: sy, vertical: false };
}

/** A car on its way, in world pixels: `t` 0 is the entry, 1 the spot (eased, and never past the ends). */
export function carAt(entry: Point, spot: Point, t: number): Point {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const eased = k * (2 - k);
  return {
    x: entry.x + (spot.x * TILE + TILE / 2 - entry.x) * eased,
    y: entry.y + (spot.y * TILE + TILE / 2 - entry.y) * eased,
  };
}
