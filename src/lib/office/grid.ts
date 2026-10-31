/**
 * The Office's ground on the phone: 16 px tiles, a walkable map, and A* over
 * it. A port of the web's `frontend/src/app/rooms/office/grid.ts` (docs/OFFICE.md,
 * phase 1) - the maths are the same, the camera's whole-number scale is what
 * keeps a pixel view crisp on a phone.
 *
 * The view draws in world pixels (a tile is 16 of them) at an integer scale;
 * this file is the maths between the two, and the path a character would walk
 * from its seat to the kitchen.
 */

/** One tile, in world pixels. */
export const TILE = 16;

export interface Point {
  x: number;
  y: number;
}

/** A floor as tiles: `walk[y * w + x]` is 1 where a character may stand. */
export interface Grid {
  w: number;
  h: number;
  walk: Uint8Array;
}

/** A grid of `w`×`h` tiles, every one walkable but those named. */
export function gridOf(w: number, h: number, blocked: Iterable<Point> = []): Grid {
  const grid: Grid = { w, h, walk: new Uint8Array(Math.max(0, w * h)).fill(1) };
  for (const p of blocked) block(grid, p);
  return grid;
}

/** A wall, a desk, a plant: nothing walks through it. */
export function block(grid: Grid, p: Point): void {
  if (inside(grid, p)) grid.walk[p.y * grid.w + p.x] = 0;
}

export function inside(grid: Grid, p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < grid.w && p.y < grid.h;
}

export function walkable(grid: Grid, p: Point): boolean {
  return inside(grid, p) && grid.walk[p.y * grid.w + p.x] === 1;
}

/** The nearest walkable tile to `p` (itself when it is one), searching rings outwards; null when none is
 *  within `max` tiles. A seat can be named on a tile a chair stands on, so a character's real target is
 *  often found this way. */
export function nearestWalkable(grid: Grid, p: Point, max = 10): Point | null {
  if (walkable(grid, p)) return p;
  for (let r = 1; r <= max; r++) {
    let best: Point | null = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (!walkable(grid, q)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

const STEPS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * A* from one tile to another, four directions only (the walk cycle has four),
 * the shortest path; null when nothing connects them. The start is not part of
 * the path, the target is.
 */
export function findPath(grid: Grid, from: Point, to: Point): Point[] | null {
  const start = nearestWalkable(grid, from);
  const goal = nearestWalkable(grid, to);
  if (!start || !goal) return null;
  const n = grid.w * grid.h;
  const at = (p: Point) => p.y * grid.w + p.x;
  const s = at(start);
  const g = at(goal);
  if (s === g) return [];

  const gScore = new Int32Array(n).fill(0x3fffffff);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new MinHeap();
  gScore[s] = 0;
  open.push(s, heuristic(start, goal));
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === g) return rebuild(came, g, grid.w);
    const cx = cur % grid.w;
    const cy = (cur - cx) / grid.w;
    for (const d of STEPS) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (nx < 0 || ny < 0 || nx >= grid.w || ny >= grid.h) continue;
      const ni = ny * grid.w + nx;
      if (closed[ni] || grid.walk[ni] !== 1) continue;
      const step = gScore[cur] + 1;
      if (step >= gScore[ni]) continue;
      gScore[ni] = step;
      came[ni] = cur;
      open.push(ni, step + Math.abs(nx - goal.x) + Math.abs(ny - goal.y));
    }
  }
  return null;
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function rebuild(came: Int32Array, goal: number, w: number): Point[] {
  const out: Point[] = [];
  let cur = goal;
  while (cur >= 0) {
    const x = cur % w;
    out.push({ x, y: (cur - x) / w });
    cur = came[cur];
  }
  out.pop(); // the start tile: already stood on
  return out.reverse();
}

/** A small binary heap of (tile index, f): the order a path's front is looked at in. */
class MinHeap {
  private idx: number[] = [];
  private key: number[] = [];

  get size(): number {
    return this.idx.length;
  }

  push(i: number, f: number): void {
    this.idx.push(i);
    this.key.push(f);
    let c = this.idx.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.key[p] <= this.key[c]) break;
      this.swap(p, c);
      c = p;
    }
  }

  pop(): number {
    const top = this.idx[0];
    const lastI = this.idx.pop() as number;
    const lastK = this.key.pop() as number;
    if (this.idx.length) {
      this.idx[0] = lastI;
      this.key[0] = lastK;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < this.idx.length && this.key[l] < this.key[m]) m = l;
        if (r < this.idx.length && this.key[r] < this.key[m]) m = r;
        if (m === c) break;
        this.swap(m, c);
        c = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const i = this.idx[a];
    this.idx[a] = this.idx[b];
    this.idx[b] = i;
    const k = this.key[a];
    this.key[a] = this.key[b];
    this.key[b] = k;
  }
}

// ---- tiles and pixels -------------------------------------------------------------------

/** The top-left corner of a tile, in world pixels. */
export function tileToPx(x: number, y: number): Point {
  return { x: x * TILE, y: y * TILE };
}

/** The middle of a tile: where a character stands. */
export function tileCentre(p: Point): Point {
  return { x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 };
}

/** The tile a world pixel is on. */
export function pxToTile(p: Point): Point {
  return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
}

/** How far apart two tiles are, in tiles (four-direction walking: the sum is the steps). */
export function tileSteps(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// ---- the camera -------------------------------------------------------------------------

/**
 * The scale a floor is drawn at to fit a window: the largest whole number of
 * device pixels per tile. The web keeps to ×2-×3; a phone's view is 390 pt
 * wide and a floor can be 24 tiles (384 px), so the phone allows ×1 - a floor
 * too big even for that is drawn at ×1 and panned. `max` 4: past that a 16 px
 * tile is a block, not a room.
 */
export function fitScale(floorW: number, floorH: number, viewW: number, viewH: number, min = 1, max = 4): number {
  const byW = Math.floor(viewW / (floorW * TILE));
  const byH = Math.floor(viewH / (floorH * TILE));
  const fit = Math.min(byW, byH);
  return Math.max(min <= max ? min : max, Math.min(max, fit || min));
}

export interface Camera {
  /** The world pixel at the view's top-left. */
  x: number;
  y: number;
  /** Device pixels per world pixel: a whole number, so nothing blurs. */
  scale: number;
}

/** The camera that centres a floor in a window at `scale`, never showing past its edges. */
export function centreCamera(floorW: number, floorH: number, viewW: number, viewH: number, scale: number): Camera {
  const w = floorW * TILE;
  const h = floorH * TILE;
  const cam = { x: (w - viewW / scale) / 2, y: (h - viewH / scale) / 2, scale };
  return clampCamera(cam, floorW, floorH, viewW, viewH);
}

/** Keep the floor over the window: no empty band past an edge, and a floor smaller than the view centred. */
export function clampCamera(cam: Camera, floorW: number, floorH: number, viewW: number, viewH: number): Camera {
  const w = floorW * TILE;
  const h = floorH * TILE;
  const vw = viewW / cam.scale;
  const vh = viewH / cam.scale;
  const x = w <= vw ? (w - vw) / 2 : Math.min(Math.max(cam.x, 0), w - vw);
  const y = h <= vh ? (h - vh) / 2 : Math.min(Math.max(cam.y, 0), h - vh);
  return { x, y, scale: cam.scale };
}

/** A world point on the screen, in device pixels. */
export function toScreen(cam: Camera, p: Point, dpr = 1): Point {
  return { x: (p.x - cam.x) * cam.scale * dpr, y: (p.y - cam.y) * cam.scale * dpr };
}

/** A screen point (device pixels) back in the world. */
export function toWorld(cam: Camera, p: Point, dpr = 1): Point {
  return { x: p.x / (cam.scale * dpr) + cam.x, y: p.y / (cam.scale * dpr) + cam.y };
}
