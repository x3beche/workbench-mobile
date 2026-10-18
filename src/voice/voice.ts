/** The pure parts of voice input: limits, names and what a person reads. */
import type { AudioFile, VoiceLang } from '../api/client';

/** The server takes up to about five minutes; recording stops itself just before. */
export const MAX_RECORD_MS = 295_000;

export const VOICE_LANGS: { id: VoiceLang; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' },
];

/**
 * When the words appear: while speaking (the server's own Whisper over
 * WS /api/voice/live, where it offers it), or once the recording is done
 * (POST /api/voice/transcribe, the voice job's model). Live falls back to
 * after-recording by itself.
 */
export type VoiceMode = 'live' | 'record';

export const VOICE_MODES: { id: VoiceMode; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'record', label: 'After recording' },
];

/** Said in place of the live words when the server does not offer them. */
export const NO_LIVE = 'Live voice to text is not available here - the words are written out when you stop.';
/** Said when the live words stop part way. */
export const LIVE_BROKE = 'Live voice to text stopped - the recording is written out when you stop.';

export function langLabel(lang: VoiceLang): string {
  return VOICE_LANGS.find((l) => l.id === lang)?.label ?? 'Auto';
}

/** 0:07, 1:42, 12:03. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const PERMISSION_DENIED =
  'Microphone access is off for Workbench. Allow it in your device settings to record a voice message.';

/**
 * The recording as the upload wants it. On a phone it is an .m4a file on
 * disk (AAC in MP4); in a browser the recorder gives a blob: URL of WebM.
 */
export async function audioFileFor(
  uri: string,
  platform: string,
  fetchBlob: (uri: string) => Promise<Blob> = async (u) => (await fetch(u)).blob(),
): Promise<AudioFile> {
  if (platform === 'web') {
    const blob = await fetchBlob(uri);
    const webm = !blob.type || blob.type.includes('webm');
    return { blob, name: webm ? 'voice.webm' : 'voice.m4a' };
  }
  const ext = (uri.split('?')[0].match(/\.(\w+)$/)?.[1] || 'm4a').toLowerCase();
  const type = ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : ext === 'aac' ? 'audio/aac' : `audio/${ext}`;
  return { uri, name: `voice.${ext}`, type };
}

/** Sentences a person reads for a failed transcription, by HTTP status. */
export function voiceError(status: number, detail: string): string {
  if (status === 503) return detail || 'Voice is not set up on this server.';
  if (status === 502) return detail || 'The transcription service failed. Try again.';
  if (status === 400) return detail || 'That recording could not be used (too long or unreadable).';
  return detail || 'The recording could not be transcribed.';
}
