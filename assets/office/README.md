# The Office's art

The same `atlas.png` and `manifest.json` the web app ships (`redline-studio`,
`frontend/src/assets/office/`, drawn by its `scripts/office-art.mjs`): 16 px
tiles, named sprites, and the PNG they are cut from. It is **copied into the
app**, not fetched: a few tens of KB, drawn offline and on the first frame, with
no route, no auth header and no flicker of placeholder shapes between opening the
screen and the picture arriving. `src/lib/office/art.ts` loads it,
`src/lib/office/atlas.ts` reads the manifest, and `src/components/OfficeView.tsx`
draws the sprites out of the sheet (its own drawn shapes only where the atlas has
none).

**The one addition to the web's manifest is `image_size`** (`w`, `h`): a browser
reads the sheet's size off the image it loaded, and a `require`d asset cannot be
asked synchronously on the phone. Re-copying the web's manifest over this one is
fine — the size then falls back to the furthest frame edge, a few pixels short of
the real sheet, which puts every sprite slightly off.

`src/lib/__tests__/officeArt.test.ts` holds the two things that go wrong quietly:
the sheet's size disagreeing with the PNG's own (read out of its header), and a
sprite name the view asks for that the atlas does not have.

Everything else - the sprites' names, the four ways of the walk, the eight looks
an agent's name picks from - is the web's own README's: `frontend/src/assets/office/README.md`.
