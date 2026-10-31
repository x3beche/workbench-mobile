/**
 * The Office's art, as the web app reads it (`frontend/src/assets/office/README.md`):
 * one `atlas.json` and one `atlas.png`, 16 px tiles, named sprites with frames
 * and (for the walk) a frame per direction.
 *
 * The art has not landed yet - the web's `manifest.json` still has
 * `"image": null` and an empty `sprites` - so this module is the interface and
 * nothing else: the phone draws the same placeholder shapes the web's engine
 * does until a manifest with a picture arrives. The decision (written down in
 * docs/OFFICE.md): the atlas is **copied into the app's assets**, not fetched.
 * It is a few tens of KB, it draws offline and on the first frame, and a fetch
 * would add a route, an auth header and a flicker for no gain.
 */
import type { Dir } from './anim';

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Sprite {
  frames: SpriteFrame[];
  /** The frame each way starts at (a walk cycle's four directions), when the sprite has them. */
  dirs?: Partial<Record<Dir, number>>;
}

export interface Atlas {
  version: number;
  /** One tile, in the atlas's own pixels (16). */
  tile: number;
  /** The PNG's name, or null while the art has not landed. */
  image: string | null;
  sprites: Record<string, Sprite>;
}

/** A manifest read into the shape above, or null when it is not one (an older or broken file). */
export function atlasOf(raw: unknown): Atlas | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.version !== 'number' || typeof m.tile !== 'number' || m.tile <= 0) return null;
  if (m.image !== null && typeof m.image !== 'string') return null;
  const sprites: Record<string, Sprite> = {};
  const src = m.sprites && typeof m.sprites === 'object' ? (m.sprites as Record<string, unknown>) : {};
  for (const [name, value] of Object.entries(src)) {
    const s = value as Record<string, unknown>;
    if (!s || !Array.isArray(s.frames)) continue;
    const frames = s.frames.filter(isFrame);
    if (!frames.length) continue;
    const dirs: Partial<Record<Dir, number>> = {};
    if (s.dirs && typeof s.dirs === 'object') {
      for (const d of ['n', 'e', 's', 'w'] as const) {
        const i = (s.dirs as Record<string, unknown>)[d];
        if (typeof i === 'number' && i >= 0 && i < frames.length) dirs[d] = i;
      }
    }
    sprites[name] = { frames, ...(Object.keys(dirs).length ? { dirs } : {}) };
  }
  return { version: m.version, tile: m.tile, image: m.image, sprites };
}

function isFrame(v: unknown): v is SpriteFrame {
  const f = v as SpriteFrame;
  return !!f && [f.x, f.y, f.w, f.h].every((n) => typeof n === 'number' && n >= 0) && f.w > 0 && f.h > 0;
}

/** Whether there is a picture to draw: a manifest with a PNG and at least one sprite. */
export function hasArt(atlas: Atlas | null): atlas is Atlas {
  return !!atlas && !!atlas.image && Object.keys(atlas.sprites).length > 0;
}

/** The frame of `name` to draw: its `dirs[dir]` plus the animation frame, wrapped; null when the atlas has
 *  no such sprite (the view then keeps its placeholder shape). */
export function spriteFrame(atlas: Atlas | null, name: string, frame = 0, dir?: Dir): SpriteFrame | null {
  const sprite = atlas?.sprites[name];
  if (!sprite || !sprite.frames.length) return null;
  const start = dir !== undefined ? sprite.dirs?.[dir] ?? 0 : 0;
  const i = (start + Math.max(0, Math.floor(frame))) % sprite.frames.length;
  return sprite.frames[i] ?? null;
}

/** The sprite a pose stands in for, if the art lands with the interface's names. */
export function poseSprite(pose: string): string {
  switch (pose) {
    case 'type': return 'agent.type';
    case 'think': return 'agent.think';
    case 'raise': return 'agent.raise';
    case 'cup': return 'agent.cup';
    case 'sit': return 'agent.sit';
    case 'alert': return 'agent.alert';
    case 'walk': return 'agent.walk';
    default: return 'agent.walk';
  }
}

/** The sprite a piece of furniture is drawn from: the item kind's own, else the floor tile. */
export function itemSprite(kind: string): string {
  return `item.${kind}`;
}
