/**
 * The Office's ground: tiles, A* and the camera (lib/office/grid.ts, a port of
 * the web's frontend/src/app/rooms/office/grid.ts).
 */
import {
  TILE,
  block,
  centreCamera,
  clampCamera,
  findPath,
  fitScale,
  gridOf,
  inside,
  nearestWalkable,
  pxToTile,
  tileCentre,
  tileSteps,
  toScreen,
  toWorld,
  walkable,
  type Grid,
} from '../office/grid';

/** A 6×4 grid, with the column x=2 walled off but a gap at y=3. */
function wall(): Grid {
  const g = gridOf(6, 4);
  for (let y = 0; y < 3; y++) block(g, { x: 2, y });
  return g;
}

describe("the office's ground", () => {
  it('starts all walkable, and blocking is remembered', () => {
    const g = gridOf(3, 2);
    expect(g.walk.length).toBe(6);
    expect(walkable(g, { x: 2, y: 1 })).toBe(true);
    block(g, { x: 2, y: 1 });
    expect(walkable(g, { x: 2, y: 1 })).toBe(false);
    expect(inside(g, { x: 3, y: 0 })).toBe(false);
    expect(inside(g, { x: -1, y: 0 })).toBe(false);
  });

  it('finds the nearest walkable tile outwards, and null when there is none', () => {
    const g = gridOf(5, 5, [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 3, y: 2 }]);
    expect(nearestWalkable(g, { x: 2, y: 2 })).toEqual({ x: 2, y: 1 });
    const closed = gridOf(3, 3, [{ x: 1, y: 1 }]);
    expect(nearestWalkable(closed, { x: 1, y: 1 }, 0)).toBeNull();
  });

  it('walks a straight line without the starting tile', () => {
    const g = gridOf(5, 3);
    expect(findPath(g, { x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
    ]);
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });

  it('goes around a wall, four directions only, and never through it', () => {
    const g = wall();
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    // Down to the gap at y=3, across, and up again.
    const tiles = [{ x: 0, y: 0 }, ...(path as { x: number; y: number }[])];
    expect(tiles).toContainEqual({ x: 2, y: 3 });
    for (const p of tiles) expect(g.walk[p.y * g.w + p.x]).toBe(1);
    for (let i = 1; i < tiles.length; i++) {
      expect(tileSteps(tiles[i - 1], tiles[i])).toBe(1);
    }
    expect(tiles[tiles.length - 1]).toEqual({ x: 4, y: 0 });
  });

  it('says null when a wall has no way through', () => {
    const g = gridOf(5, 3);
    for (let y = 0; y < 3; y++) block(g, { x: 2, y });
    expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
  });

  it('turns tiles into pixels and back', () => {
    expect(TILE).toBe(16);
    expect(tileCentre({ x: 0, y: 0 })).toEqual({ x: 8, y: 8 });
    expect(tileCentre({ x: 3, y: 2 })).toEqual({ x: 56, y: 40 });
    expect(pxToTile({ x: 56, y: 40 })).toEqual({ x: 3, y: 2 });
    expect(pxToTile({ x: 63, y: 47 })).toEqual({ x: 3, y: 2 });
    expect(tileSteps({ x: 1, y: 1 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("the office's camera", () => {
  it('fits a 24-tile floor on a 390 pt phone at ×1, and a small one at ×4', () => {
    // 390 / (24*16) = 1.01, 844 / (14*16) = 3.7: the width is what fits.
    expect(fitScale(24, 14, 390, 844)).toBe(1);
    expect(fitScale(10, 8, 390, 844)).toBe(2);
    expect(fitScale(4, 3, 390, 844)).toBe(4);
    expect(fitScale(100, 100, 390, 844)).toBe(1);
  });

  it('centres a floor and clamps it so no empty band shows at an edge', () => {
    const cam = centreCamera(24, 14, 390, 400, 2);
    // The floor is 768×448 on the screen: 195×200 of the world shows, so it is centred and never panned
    // past an edge.
    expect(cam.x).toBeCloseTo((384 - 195) / 2);
    expect(cam.y).toBeCloseTo((224 - 200) / 2);
    const wide = centreCamera(4, 3, 390, 400, 2);
    expect(wide.x).toBeLessThan(0);         // the floor is smaller than the view: centred
    expect(wide.y).toBeLessThan(0);

    const moved = clampCamera({ x: 9999, y: -40, scale: 2 }, 24, 14, 390, 400);
    expect(moved.x).toBe(24 * 16 - 390 / 2);
    expect(moved.y).toBe(0);
  });

  it('maps world points to the screen and back', () => {
    const cam = { x: 10, y: 20, scale: 2 };
    const screen = toScreen(cam, { x: 30, y: 50 });
    expect(screen).toEqual({ x: 40, y: 60 });
    expect(toWorld(cam, screen)).toEqual({ x: 30, y: 50 });
    expect(toScreen(cam, { x: 10, y: 20 }, 2)).toEqual({ x: 0, y: 0 });
  });
});
