/**
 * The Office's art interface (lib/office/atlas.ts): the web's manifest.json, read here - frames, the sheet's
 * size, the walk's four ways, and the look an agent's name picks.
 */
import manifest from '../../../assets/office/manifest.json';
import {
  atlasOf,
  fnv1a32,
  hasArt,
  itemSprite,
  poseSprite,
  spriteFrame,
  variantOf,
  walkSprite,
  withLook,
  type Atlas,
} from '../office/atlas';

const MANIFEST = {
  version: 1,
  tile: 16,
  image: 'atlas.png',
  sprites: {
    'agent.walk': {
      frames: [{ x: 0, y: 0, w: 12, h: 20 }, { x: 12, y: 0, w: 12, h: 20 }, { x: 24, y: 0, w: 12, h: 20 }],
      dirs: { n: 0, e: 1, s: 2 },
    },
    'item.desk': { frames: [{ x: 0, y: 40, w: 24, h: 16 }] },
  },
};

describe("the office's atlas", () => {
  it('reads a manifest with no picture, and says there is nothing to draw', () => {
    const atlas = atlasOf({ version: 1, tile: 16, image: null, sprites: {} });
    expect(atlas).toMatchObject({ version: 1, tile: 16, image: null, sprites: {}, variants: [] });
    expect(atlas?.sheet).toEqual({ w: 1, h: 1 });      // nothing to measure
    expect(hasArt(atlas)).toBe(false);
    expect(spriteFrame(atlas, 'agent.walk', 0, 'e')).toBeNull();
  });

  it('reads frames, and a direction starts its own frame of the cycle', () => {
    const atlas = atlasOf(MANIFEST) as Atlas;
    expect(hasArt(atlas)).toBe(true);
    expect(spriteFrame(atlas, 'agent.walk', 0, 'n')).toEqual({ x: 0, y: 0, w: 12, h: 20 });
    expect(spriteFrame(atlas, 'agent.walk', 0, 'e')).toEqual({ x: 12, y: 0, w: 12, h: 20 });
    expect(spriteFrame(atlas, 'agent.walk', 1, 'e')).toEqual({ x: 24, y: 0, w: 12, h: 20 }); // wrapped
    expect(spriteFrame(atlas, 'item.desk', 9)).toEqual({ x: 0, y: 40, w: 24, h: 16 });
    expect(spriteFrame(atlas, 'item.plant')).toBeNull();
    // No `image_size` in the manifest: the sheet is measured from the frames it holds.
    expect(atlas.sheet).toEqual({ w: 36, h: 56 });   // the furthest frame edge
  });

  it('takes the sheet’s own size when the manifest names it, and the variants it lists', () => {
    const atlas = atlasOf({ ...MANIFEST, image_size: { w: 512, h: 217 }, variants: ['v0', 'v1', 'v2'] });
    expect(atlas?.sheet).toEqual({ w: 512, h: 217 });
    expect(atlas?.variants).toEqual(['v0', 'v1', 'v2']);
  });

  it('says no to a manifest that is not one, and keeps the frames it can use', () => {
    expect(atlasOf(null)).toBeNull();
    expect(atlasOf({ version: 1 })).toBeNull();
    expect(atlasOf({ version: 1, tile: 0, image: null, sprites: {} })).toBeNull();
    const atlas = atlasOf({
      version: 1, tile: 16, image: 'atlas.png',
      sprites: {
        'agent.type': { frames: [{ x: 0, y: 0, w: 0, h: 4 }, { x: 4, y: 0, w: 8, h: 8 }] },
        broken: { frames: 'no' },
      },
    });
    expect(atlas?.sprites['agent.type']?.frames).toEqual([{ x: 4, y: 0, w: 8, h: 8 }]);
    expect(atlas?.sprites.broken).toBeUndefined();
  });

  it('reads the manifest the app ships, copied from the web app', () => {
    const shipped = atlasOf(manifest);
    expect(hasArt(shipped)).toBe(true);
    expect(shipped?.tile).toBe(16);
    expect(shipped?.version).toBe(1);
    expect(shipped?.image).toBe('atlas.png');
    expect(shipped?.sheet.w).toBeGreaterThan(100);
    expect(Object.keys(shipped?.sprites ?? {}).length).toBeGreaterThan(100);
    expect(shipped?.variants).toEqual(['v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']);
  });

  it('picks a look from the agent’s name, the way the generator does', () => {
    const atlas = atlasOf(manifest);
    expect(fnv1a32('Sensor board rail sag')).toBe(fnv1a32('Sensor board rail sag'));
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'));
    const looks = new Set(['Sensor board rail sag', 'OTA image and rollback', 'Firmware notes', 'PCB design']
      .map((n) => variantOf(n, atlas)));
    expect(looks.size).toBeGreaterThan(1);            // not everybody in the same shirt
    for (const look of looks) expect(atlas?.variants).toContain(look);
    expect(variantOf('anyone', null)).toBe('');       // no manifest: the plain names
  });

  it('names the sprite a pose, a piece of furniture and a walk would use', () => {
    expect(poseSprite('type')).toBe('agent.type');
    expect(poseSprite('type', 'v3')).toBe('agent.v3.type');
    expect(poseSprite('stand')).toBe('agent.idle');
    expect(poseSprite('walk')).toBe('agent.walk');
    expect(poseSprite('something')).toBe('agent.walk');
    expect(itemSprite('coffee')).toBe('item.coffee');
    expect(walkSprite('w')).toBe('agent.walk');
    expect(walkSprite('w', 'v0')).toBe('agent.walk');
    expect(walkSprite('w', 'v3')).toBe('agent.v3.walk.left');
    expect(walkSprite('s', 'v3')).toBe('agent.v3.walk.down');
    expect(withLook('item.desk', 'v3')).toBe('item.desk');   // only the agents wear a look
  });
});
