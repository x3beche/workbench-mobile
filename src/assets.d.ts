/**
 * The bundled pictures: Metro hands a `require`d PNG back as a number (an asset id `Image` takes as its
 * source), and TypeScript only knows that if it is told once.
 */
declare module '*.png' {
  const asset: number;
  export default asset;
}
