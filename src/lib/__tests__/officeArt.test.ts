/**
 * The art the app ships (lib/office/art.ts): the sheet and its manifest are assets, so they are there on the
 * first frame and nothing is fetched. These are the two things that go wrong quietly: a sheet whose size the
 * manifest gets wrong (every sprite then lands a few pixels off), and a name the view asks for that is not in
 * the atlas (the picture falls back to a shape and nobody notices).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import manifest from '../../../assets/office/manifest.json';
import { itemSprite, poseSprite, spriteFrame, walkSprite } from '../office/atlas';
import { OFFICE_ART, OFFICE_ATLAS } from '../office/art';

/** A PNG's own size, out of its IHDR: the sheet's real pixels, not the manifest's claim. */
function pngSize(bytes: Buffer): { w: number; h: number } {
  const signature = bytes.subarray(12, 16).toString('ascii');
  expect(signature).toBe('IHDR');
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

describe('the art the app ships', () => {
  it('is loaded from the app’s own assets, not fetched', () => {
    expect(OFFICE_ATLAS).not.toBeNull();
    expect(OFFICE_ART).not.toBeNull();
    expect(OFFICE_ATLAS?.image).toBe('atlas.png');
    expect(Object.keys(OFFICE_ATLAS?.sprites ?? {}).length).toBeGreaterThan(100);
  });

  it('is the sheet the manifest says it is: the size in the file is the PNG’s own', () => {
    const png = pngSize(readFileSync(join(__dirname, '../../../assets/office/atlas.png')));
    expect(OFFICE_ATLAS?.sheet).toEqual(png);
  });

  it('holds every frame inside the sheet', () => {
    const sheet = OFFICE_ATLAS!.sheet;
    for (const [name, sprite] of Object.entries(OFFICE_ATLAS!.sprites)) {
      for (const f of sprite.frames) {
        expect({ name, fits: f.x + f.w <= sheet.w && f.y + f.h <= sheet.h }).toEqual({ name, fits: true });
      }
    }
  });

  it('has a sprite for every piece of furniture an office can hold', () => {
    // The kinds backend/office.py lays down, plus the ones a person can drop in edit mode.
    const kinds = ['desk', 'chair', 'pc', 'coffee', 'plant', 'sofa', 'board', 'shelf', 'cooler', 'counter',
                   'cup', 'car_spot'];
    for (const kind of kinds) {
      expect({ kind, sprite: !!spriteFrame(OFFICE_ATLAS, itemSprite(kind)) }).toEqual({ kind, sprite: true });
    }
  });

  it('has every pose the scene draws, in every look an agent can wear', () => {
    const poses = ['type', 'think', 'raise', 'cup', 'sit', 'alert', 'stand'];
    for (const look of OFFICE_ATLAS!.variants) {
      for (const pose of poses) {
        const name = poseSprite(pose, look);
        expect({ name, sprite: !!spriteFrame(OFFICE_ATLAS, name) }).toEqual({ name, sprite: true });
      }
      for (const dir of ['n', 'e', 's', 'w'] as const) {
        const name = walkSprite(dir, look);
        const frames = [0, 1, 2].map((f) => spriteFrame(OFFICE_ATLAS, name, f, dir));
        expect({ name, frames: frames.filter(Boolean).length }).toEqual({ name, frames: 3 });
      }
    }
  });

  it('walks the four ways with the plain look’s own dirs', () => {
    const walk = OFFICE_ATLAS!.sprites['agent.walk'];
    expect(walk.dirs).toEqual({ s: 0, n: 3, e: 6, w: 9 });
    expect(spriteFrame(OFFICE_ATLAS, 'agent.walk', 0, 'w')).toEqual(walk.frames[9]);
    expect(spriteFrame(OFFICE_ATLAS, 'agent.walk', 2, 'n')).toEqual(walk.frames[5]);
  });

  it('keeps the manifest it was read from the web’s own, plus the sheet’s size', () => {
    // The phone cannot ask a `require`d asset its size, so the manifest carries it; everything else is the
    // web's file, unchanged (sprites, frames, dirs, variants and the generator's own note).
    expect(manifest.image).toBe('atlas.png');
    expect(manifest.image_size).toEqual({ w: 512, h: 217 });
    expect(Object.keys(manifest.sprites).length).toBeGreaterThan(100);
    expect(manifest.variants).toHaveLength(8);
    expect(manifest.note).toMatch(/scripts\/office-art\.mjs/);
  });
});
