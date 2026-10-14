/*
 * Draws the app icons from the web app's section mark (redline-studio
 * frontend/public/favicon.svg) into assets/. Run in headless Chrome:
 *
 *   docker run --rm -u 1000:1000 -v "$PWD/assets:/out" -v "$PWD/scripts/make-icons.js:/usr/src/app/s.js" \
 *     zenika/alpine-chrome:with-puppeteer node /usr/src/app/s.js
 */
const puppeteer = require('puppeteer');

const MARK = 'M12 12H52V52H12ZM17 17V30L30 17ZM17 47H23.5L47 23.5V17H40.5L17 40.5ZM34 47H47V34Z';
const GROUND = '#09090b';
const INK = '#fafafa';

// [file, size, viewBox, ground (null = transparent), corner radius]
const ICONS = [
  ['icon.png', 1024, '0 0 64 64', GROUND, 0],
  ['android-icon-background.png', 1024, '0 0 64 64', GROUND, 0, true],
  ['android-icon-foreground.png', 1024, '-14 -14 92 92', null, 0],
  ['android-icon-monochrome.png', 1024, '-14 -14 92 92', null, 0],
  ['splash-icon.png', 1024, '-56 -56 176 176', null, 0],
  ['favicon.png', 48, '0 0 64 64', GROUND, 12],
];

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  for (const [file, size, box, ground, rx, groundOnly] of ICONS) {
    await page.setViewport({ width: size, height: size });
    const [x, y, w, h] = box.split(' ').map(Number);
    const bg = ground ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${ground}"/>` : '';
    const mark = groundOnly ? '' : `<path d="${MARK}" fill="${INK}" fill-rule="evenodd"/>`;
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${box}">${bg}${mark}</svg></body></html>`,
    );
    await page.screenshot({ path: `/out/${file}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('wrote', file);
  }
  await browser.close();
})();
