/** The PCM helpers: 16 kHz from a browser's rate, the phone's base64 chunks, the WAV for the upload. */
import { base64ToBytes, concatBytes, Downsampler, wavBytes } from '../pcm';

describe('Downsampler', () => {
  it('brings 48 kHz down to 16 kHz, a third of the samples, carried over between blocks', () => {
    const d = new Downsampler(48000);
    const a = d.push(new Float32Array(1000).fill(0.5));
    const b = d.push(new Float32Array(1000).fill(0.5));
    expect((a.length + b.length) / 2).toBe(666); // 2000 / 3, the rest waits for the next block
    const v = new DataView(a.buffer, a.byteOffset, a.byteLength);
    expect(v.getInt16(0, true)).toBe(Math.floor(0.5 * 0x7fff));
  });

  it('clips past full scale and keeps the sign', () => {
    const out = new Downsampler(16000).push(Float32Array.from([2, -2, -0.5]));
    const v = new DataView(out.buffer, out.byteOffset, out.byteLength);
    expect([v.getInt16(0, true), v.getInt16(2, true), v.getInt16(4, true)]).toEqual([32767, -32768, -16384]);
  });
});

describe('base64ToBytes', () => {
  it('reads what the phone recorder hands over', () => {
    expect(Array.from(base64ToBytes('AAEC/w=='))).toEqual([0, 1, 2, 255]);
    expect(Array.from(base64ToBytes('AAEC\n/w=='))).toEqual([0, 1, 2, 255]);
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
    expect(base64ToBytes('').length).toBe(0);
  });
});

describe('wavBytes', () => {
  it('wraps 16 kHz mono PCM16 in a RIFF header the server reads', () => {
    const pcm = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
    const wav = wavBytes(pcm);
    const v = new DataView(wav.buffer);
    const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(v.getUint32(4, true)).toBe(36 + 4);
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(4);
    expect(Array.from(wav.subarray(44))).toEqual([1, 2, 3, 4]);
  });
});
