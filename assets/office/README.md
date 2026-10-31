# The Office's art

The same `manifest.json` the web app reads (`redline-studio`,
`frontend/src/assets/office/README.md`): 16 px tiles, named sprites, and the PNG
they are cut from. It is **copied into the app**, not fetched: a few tens of
KB, drawn offline and on the first frame, with no route, no auth header and no
flicker of placeholder shapes between opening the screen and the picture
arriving. `src/lib/office/atlas.ts` reads it (and is tested against this copy);
`src/components/OfficeView.tsx` draws the web engine's placeholder shapes until
`image` names a PNG that is beside this file.

The art has not landed yet - `"image": null`, `"sprites": {}` - so the phone
shows the same coloured rooms and small figures the web does. When the PNG
lands, copy it here next to this manifest; nothing else changes.
