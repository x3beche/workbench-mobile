/**
 * The Office's art, as the app has it: `assets/office/atlas.png` and its manifest, `require`d once.
 *
 * The sheet is copied into the app, not fetched (docs/OFFICE.md, the phase-4 decision): a few tens of KB, drawn
 * offline and on the first frame, with no route, no auth header, and no flicker of placeholder shapes between
 * opening the screen and the picture arriving. `lib/office/atlas.ts` reads the manifest; `OfficeView` draws the
 * sprites it names, and its own shapes where the atlas has none.
 */
import manifest from '../../../assets/office/manifest.json';
import { atlasOf, hasArt, type Atlas } from './atlas';

/** The manifest the app ships, read once (a broken file reads as null: the view keeps its shapes). */
export const OFFICE_ATLAS: Atlas | null = atlasOf(manifest);

/** The sheet itself, when the manifest names one; null when there is no art to draw. */
export const OFFICE_ART: number | null = hasArt(OFFICE_ATLAS)
  ? (require('../../../assets/office/atlas.png') as number)
  : null;
