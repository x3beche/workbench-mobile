/**
 * The Office's art, as the web app reads it (`frontend/src/assets/office/README.md`):
 * one `atlas.png` and one `manifest.json`, 16 px tiles, named sprites with
 * frames and (for the walk) a frame per direction.
 *
 * The art has landed (redline-studio `067d933`): the sheet and the manifest are
 * **copied into the app's assets** - a few tens of KB, drawn offline and on the
 * first frame, with no route, no auth header and no flicker of placeholder
 * shapes between opening the screen and the picture arriving (docs/OFFICE.md's
 * decision). `lib/office/art.ts` imports them; this module is the interface both
 * sides speak: a sprite by name, its frame, the look an agent gets.
 *
 * The one addition to the web's manifest is `image_size`: a browser reads the
 * sheet's own size off the image it loaded, and a `require`d asset cannot be
 * asked synchronously, so the phone keeps it in the file (and falls back to the
 * frames' extent when it is not there).
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
  /** The PNG's name, or null when there is no picture. */
  image: string | null;
  /** The sheet's size in its own pixels: what every frame's `x`/`y` is measured against. */
  sheet: { w: number; h: number };
  /** The looks an agent can wear (`v0`-`v7`), the plain sprite names being `v0`. */
  variants: string[];
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
  const variants = Array.isArray(m.variants)
    ? m.variants.filter((v): v is string => typeof v === 'string' && !!v)
    : [];
  return {
    version: m.version,
    tile: m.tile,
    image: m.image,
    sheet: sheetSize(m.image_size, sprites),
    variants,
    sprites,
  };
}

function isFrame(v: unknown): v is SpriteFrame {
  const f = v as SpriteFrame;
  return !!f && [f.x, f.y, f.w, f.h].every((n) => typeof n === 'number' && n >= 0) && f.w > 0 && f.h > 0;
}

/** The sheet's size: the manifest's own `image_size`, or the furthest frame edge when it has none. */
function sheetSize(raw: unknown, sprites: Record<string, Sprite>): { w: number; h: number } {
  const given = raw as { w?: unknown; h?: unknown } | null | undefined;
  if (given && typeof given.w === 'number' && given.w > 0 && typeof given.h === 'number' && given.h > 0) {
    return { w: given.w, h: given.h };
  }
  let w = 1;
  let h = 1;
  for (const sprite of Object.values(sprites)) {
    for (const f of sprite.frames) {
      w = Math.max(w, f.x + f.w);
      h = Math.max(h, f.y + f.h);
    }
  }
  return { w, h };
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

/** FNV-1a over the code points, 32 bits: the generator's own hash, so a name's look is the same on every page. */
export function fnv1a32(name: string): number {
  let h = 2166136261;
  for (const ch of name) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The look an agent wears: `fnv1a32(its name) % 8` over the manifest's variants ("" for the plain `v0`
 *  names, and for an atlas that names no variants). */
export function variantOf(name: string, atlas: Atlas | null): string {
  const count = atlas?.variants.length ?? 0;
  if (count < 2) return '';
  return atlas!.variants[fnv1a32(name) % count];
}

/** The sprite a pose stands in for, in the look the agent wears: `agent.type`, `agent.v3.type`, ... */
export function poseSprite(pose: string, look = ''): string {
  const plain = pose === 'type' ? 'agent.type'
    : pose === 'think' ? 'agent.think'
      : pose === 'raise' ? 'agent.raise'
        : pose === 'cup' ? 'agent.cup'
          : pose === 'sit' ? 'agent.sit'
            : pose === 'alert' ? 'agent.alert'
              : pose === 'stand' ? 'agent.idle'
                : 'agent.walk';
  return withLook(plain, look);
}

/** The walk's sprite: `agent.walk` (twelve frames, `dirs` picking the way) for the plain look, or the one
 *  direction's own sprite (`agent.v3.walk.left`) when the look has no `dirs`. */
export function walkSprite(dir: Dir, look = ''): string {
  const plain = look && look !== 'v0' ? `agent.${look}.walk.${WAY[dir]}` : 'agent.walk';
  return plain;
}

const WAY: Record<Dir, string> = { s: 'down', n: 'up', e: 'right', w: 'left' };

/** A sprite name in a look: `agent.type` + `v3` = `agent.v3.type`; `v0` is the plain name. */
export function withLook(name: string, look: string): string {
  if (!look || look === 'v0') return name;
  return name.startsWith('agent.') ? `agent.${look}.${name.slice('agent.'.length)}` : name;
}

/** The sprite a piece of furniture is drawn from: `item.desk`, `item.sofa`, ... */
export function itemSprite(kind: string): string {
  return `item.${kind}`;
}
