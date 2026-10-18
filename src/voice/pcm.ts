/**
 * The sound as live voice to text wants it: 16 kHz mono PCM16, little-endian.
 * Pure helpers, shared by the phone's and the browser's microphone and the
 * tests: bringing a browser's 44.1/48 kHz floats down to 16 kHz, reading the
 * phone recorder's base64 chunks, and wrapping what was heard in a WAV for
 * the upload when the live path is not there.
 */

export const PCM_RATE = 16000;
/** Bytes in a second of 16 kHz PCM16. */
export const PCM_BYTES_PER_S = PCM_RATE * 2;

/**
 * Any rate down to 16 kHz: each output sample the mean of the input samples
 * it stands for (a box filter, enough for speech), carried over from block to
 * block. The web app's own (rooms/voice-live.ts), returning bytes.
 */
export class Downsampler {
  private t = 0;
  private acc = 0;
  private n = 0;
  constructor(
    private readonly from: number,
    private readonly to = PCM_RATE,
  ) {}

  push(x: Float32Array): Uint8Array {
    const step = this.from / this.to;
    const out: number[] = [];
    for (let i = 0; i < x.length; i++) {
      this.acc += x[i];
      this.n++;
      if (++this.t >= step) {
        this.t -= step;
        const v = Math.max(-1, Math.min(1, this.acc / this.n));
        out.push(v < 0 ? v * 0x8000 : v * 0x7fff);
        this.acc = 0;
        this.n = 0;
      }
    }
    return int16Bytes(Int16Array.from(out));
  }
}

/** Int16 samples as little-endian bytes (every platform the app runs on is little-endian). */
export function int16Bytes(x: Int16Array): Uint8Array {
  return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_AT = (() => {
  const at = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) at[B64.charCodeAt(i)] = i;
  return at;
})();

/** Base64 to bytes (the phone recorder hands its chunks over as base64); stops at padding. */
export function base64ToBytes(s: string): Uint8Array {
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let n = 0;
  let bits = 0;
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 61) break; // '='
    const v = c < 128 ? B64_AT[c] : -1;
    if (v < 0) continue; // line breaks and the like
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, n);
}

/** Chunks into one run of bytes. */
export function concatBytes(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const all = new Uint8Array(len);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

/** 16 kHz mono PCM16 in a WAV file (the 44-byte RIFF header, then the samples). */
export function wavBytes(pcm: Uint8Array, rate = PCM_RATE): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const tag = (at: number, s: string) => {
    for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i);
  };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, 'data');
  v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}
