/**
 * The phone's microphone as live voice to text wants it: 16 kHz mono PCM16,
 * handed over every 100 ms while it records.
 *
 * expo-audio records to a file and gives nothing until it stops, so this
 * uses @siteed/audio-studio (an Expo module with a config plugin, app.json):
 * Android's AudioRecord and iOS's AVAudioEngine at 16 kHz, the samples as
 * base64 chunks in its "AudioData" event, and the same samples written to a
 * WAV file - which is what goes to POST /api/voice/transcribe when the live
 * path is not there or breaks, so one microphone serves both and nothing
 * said in between is lost. The web build has its own (pcmMic.web.ts).
 *
 * Where the module is not in the build (Expo Go), `openPcmMic` throws and
 * the caller records with expo-audio, as before.
 */
import type { AudioFile } from '../api/client';
import { base64ToBytes } from './pcm';

export interface PcmMic {
  /** Stop; the recording for the upload (a WAV), or null when nothing was kept. */
  stop(): Promise<AudioFile | null>;
  /** Stop and throw it away. */
  cancel(): Promise<void>;
}

interface Subscription {
  remove(): void;
}

interface StudioModule {
  startRecording(options: Record<string, unknown>): Promise<unknown>;
  stopRecording(): Promise<{ fileUri?: string; size?: number } | null>;
  addListener(event: string, fn: (e: { deltaSize?: number; encoded?: string }) => void): Subscription;
}

function studio(): StudioModule {
  // Required here, not at the top: a build without the native module
  // (Expo Go) throws on loading it, and then the old recorder is used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@siteed/audio-studio').AudioStudioModule as StudioModule | undefined;
  if (!mod?.startRecording) throw new Error('no PCM microphone in this build');
  return mod;
}

export async function openPcmMic(onPcm: (bytes: Uint8Array) => void): Promise<PcmMic> {
  const mod = studio();
  const sub = mod.addListener('AudioData', (e) => {
    if (!e?.deltaSize || !e.encoded) return;
    onPcm(base64ToBytes(e.encoded));
  });
  try {
    await mod.startRecording({
      sampleRate: 16000,
      channels: 1,
      encoding: 'pcm_16bit',
      interval: 100,
      keepAwake: false, // the screen is on while dictating; a wake lock would need WAKE_LOCK
      showNotification: false,
      enableProcessing: false,
      output: { primary: { enabled: true, format: 'wav' }, compressed: { enabled: false } },
      ios: {
        audioSession: {
          category: 'PlayAndRecord',
          mode: 'Default',
          categoryOptions: ['DefaultToSpeaker', 'AllowBluetooth'],
        },
      },
    });
  } catch (e) {
    sub.remove();
    throw e;
  }
  let open = true;
  const end = async () => {
    if (!open) return null;
    open = false;
    try {
      return await mod.stopRecording();
    } finally {
      sub.remove();
    }
  };
  return {
    async stop() {
      const got = await end();
      if (!got?.fileUri || !got.size) return null;
      const uri = got.fileUri.startsWith('file://') ? got.fileUri : `file://${got.fileUri}`;
      return { uri, name: 'voice.wav', type: 'audio/wav' };
    },
    async cancel() {
      const got = await end().catch(() => null);
      if (got?.fileUri) forgetRecording({ uri: got.fileUri, name: 'voice.wav', type: 'audio/wav' });
    },
  };
}

/** The WAV is the app's own; once written out (or thrown away) it goes. */
export function forgetRecording(file: AudioFile): void {
  if (!('uri' in file)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const f = new File(file.uri.startsWith('file://') ? file.uri : `file://${file.uri}`);
    if (f.exists) f.delete();
  } catch {
    /* the cache is cleared by the system in the end */
  }
}
