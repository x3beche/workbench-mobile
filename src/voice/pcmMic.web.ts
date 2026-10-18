/**
 * The browser's microphone as live voice to text wants it, as the web app
 * takes it (redline-studio rooms/voice-live.ts): getUserMedia, an
 * AudioWorklet that hands each block of samples over as it comes (a
 * ScriptProcessor where there is none), brought down to 16 kHz mono PCM16
 * here. What was heard is also kept, and given back as a WAV for the upload
 * when the live path is not there or breaks.
 */
import type { AudioFile } from '../api/client';
import { concatBytes, Downsampler, PCM_BYTES_PER_S, wavBytes } from './pcm';

export interface PcmMic {
  stop(): Promise<AudioFile | null>;
  cancel(): Promise<void>;
}

/** The worklet: hands each block of samples to the page as it comes. */
const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('wb-voice-tap', Tap);`;
let workletUrl: string | null = null;

/** The upload takes five minutes; past that nothing more is kept. */
const KEEP_MAX = 300 * PCM_BYTES_PER_S;

export async function openPcmMic(onPcm: (bytes: Uint8Array) => void): Promise<PcmMic> {
  const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const AC = w.AudioContext ?? w.webkitAudioContext;
  if (!AC || !navigator.mediaDevices?.getUserMedia) throw new Error('no audio API here');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const ctx = new AC();
  let nodes: AudioNode[] = [];
  const kept: Uint8Array[] = [];
  let keptLen = 0;
  const down = new Downsampler(ctx.sampleRate);
  const take = (x: Float32Array) => {
    const pcm = down.push(x);
    if (!pcm.length) return;
    if (keptLen < KEEP_MAX) {
      kept.push(pcm);
      keptLen += pcm.length;
    }
    onPcm(pcm);
  };
  const release = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* gone */
      }
    }
    nodes = [];
    stream.getTracks().forEach((t) => t.stop());
    if (ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  };
  try {
    const src = ctx.createMediaStreamSource(stream);
    if (ctx.audioWorklet) {
      workletUrl ??= URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(workletUrl);
      const tap = new AudioWorkletNode(ctx, 'wb-voice-tap');
      tap.port.onmessage = (m) => take(m.data as Float32Array);
      src.connect(tap);
      nodes = [src, tap];
    } else {
      const sp = ctx.createScriptProcessor(4096, 1, 1);
      sp.onaudioprocess = (e) => take(new Float32Array(e.inputBuffer.getChannelData(0)));
      const mute = ctx.createGain();
      mute.gain.value = 0;
      src.connect(sp); // it runs only when connected
      sp.connect(mute);
      mute.connect(ctx.destination);
      nodes = [src, sp, mute];
    }
    if (ctx.state === 'suspended') await ctx.resume();
  } catch (e) {
    release();
    throw e;
  }
  let open = true;
  return {
    async stop() {
      if (!open) return null;
      open = false;
      release();
      if (!keptLen) return null;
      const wav = wavBytes(concatBytes(kept));
      return { blob: new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' }), name: 'voice.wav' };
    },
    async cancel() {
      open = false;
      release();
    },
  };
}

/** Nothing on disk in a browser. */
export function forgetRecording(_file: AudioFile): void {}
