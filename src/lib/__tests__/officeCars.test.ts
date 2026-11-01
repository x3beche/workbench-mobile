/**
 * The office's cars (lib/office/cars.ts): the colour an agent always drives, the edge of the yard a car comes in
 * from, and the drive along it - the web's `cars.ts` and its tween.
 */
import { carAt, carEntry, carHue, CAR_IN_MS, CAR_OUT_MS } from '../office/cars';

describe('a car', () => {
  it('is the same colour for the same name, and a different one for another', () => {
    expect(carHue('Sensor board rail sag')).toBe(carHue('Sensor board rail sag'));
    expect(carHue('Sensor board rail sag')).not.toBe(carHue('OTA image and rollback'));
    for (const name of ['a', 'Bob', '', 'wbo:ses_04f1c4d1']) {
      const hue = carHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('comes in from the yard edge nearest the car park', () => {
    // The park on the top row: in from the top, nose-up, aligned with the spot.
    const top = carEntry(24, 14, { x: 20, y: 1 }, { x: 19, y: 0, w: 4, h: 4 });
    expect(top.vertical).toBe(true);
    expect(top.y).toBeLessThan(0);
    expect(top.x).toBe(20 * 16 + 8);

    // The park at the bottom: in from below.
    const bottom = carEntry(24, 14, { x: 20, y: 12 }, { x: 19, y: 11, w: 4, h: 3 });
    expect(bottom.vertical).toBe(true);
    expect(bottom.y).toBeGreaterThan(14 * 16);

    // The park on the left: in from the left, across, not nose-up.
    const left = carEntry(30, 14, { x: 2, y: 4 }, { x: 0, y: 2, w: 4, h: 5 });
    expect(left.vertical).toBe(false);
    expect(left.x).toBeLessThan(0);
    expect(left.y).toBe(4 * 16 + 8);

    // A floor with no parking room still has an edge: the spot's own nearest one.
    const bare = carEntry(24, 14, { x: 23, y: 13 });
    expect(bare.vertical).toBe(false);
    expect(bare.x).toBeGreaterThan(24 * 16);
  });

  it('drives in from the entry to the spot, eased, and never past either end', () => {
    const entry = { x: 0, y: -24 };
    const spot = { x: 3, y: 0 };
    expect(carAt(entry, spot, 0)).toEqual({ x: 0, y: -24 });
    expect(carAt(entry, spot, 1)).toEqual({ x: 3 * 16 + 8, y: 8 });
    expect(carAt(entry, spot, -1)).toEqual(carAt(entry, spot, 0));
    expect(carAt(entry, spot, 2)).toEqual(carAt(entry, spot, 1));
    const half = carAt(entry, spot, 0.5);
    expect(half.x).toBeGreaterThan(0);
    expect(half.x).toBeLessThan(3 * 16 + 8);
    expect(CAR_OUT_MS).toBeLessThan(CAR_IN_MS);     // out is quicker than in, as the web has it
  });
});
