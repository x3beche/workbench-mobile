/**
 * The Office's art interface (lib/office/atlas.ts): the web's manifest.json and
 * atlas.png, read here. The art has not landed - `image` is null and there are
 * no sprites - so the interface must say so and the view keep its shapes.
 */
import manifest from '../../../assets/office/manifest.json';
import { atlasOf, hasArt, itemSprite, poseSprite, spriteFrame, type Atlas } from '../office/atlas';

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
  it('reads the manifest the web ships while the art is missing', () => {
    const atlas = atlasOf({ version: 1, tile: 16, image: null, sprites: {} });
    expect(atlas).toEqual({ version: 1, tile: 16, image: null, sprites: {} });
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
    expect(shipped).not.toBeNull();
    expect(shipped?.tile).toBe(16);
    expect(shipped?.version).toBe(1);
    // Until the art lands the web's own manifest names no picture: the view keeps its placeholders.
    expect(shipped?.image).toBeNull();
  });

  it('names the sprite a pose and a piece of furniture would use', () => {
    expect(poseSprite('type')).toBe('agent.type');
    expect(poseSprite('walk')).toBe('agent.walk');
    expect(poseSprite('something')).toBe('agent.walk');
    expect(itemSprite('coffee')).toBe('item.coffee');
  });
});
