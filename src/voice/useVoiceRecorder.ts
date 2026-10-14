/**
 * Record a voice message and turn it into text with the server.
 * idle -> recording -> transcribing -> idle (with the text) or error.
 * Nothing is sent by this hook: the text goes to whoever asked for it.
 */
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError, type VoiceLang, type WorkbenchClient } from '../api/client';
import { audioFileFor, MAX_RECORD_MS, PERMISSION_DENIED, voiceError } from './voice';

export type VoicePhase = 'idle' | 'recording' | 'transcribing';

/** Speech, not music: one channel at a modest rate keeps five minutes small. */
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64_000,
  web: { mimeType: 'audio/webm', bitsPerSecond: 64_000 },
};

/**
 * `onText` gets the transcript whenever a recording ends well - by `finish`,
 * or by the recorder stopping itself at the length limit.
 */
export function useVoiceRecorder(
  client: WorkbenchClient | null,
  lang: VoiceLang,
  purpose: 'chat' | 'note',
  onText: (text: string | null) => void,
) {
  const recorder = useAudioRecorder(OPTIONS);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<() => void>(() => undefined);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const start = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      setError(null);
      if (!perm.granted) {
        setError(PERMISSION_DENIED);
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(e instanceof Error && /permission|denied|notallowed/i.test(e.message) ? PERMISSION_DENIED : 'The microphone could not be started.');
      return false;
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase('recording');
    timer.current = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_RECORD_MS) finishRef.current();
    }, 250);
    return true;
  }, [recorder]);

  const halt = useCallback(async () => {
    clearTimer();
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      /* not every platform has a mode to reset */
    }
  }, [recorder]);

  /** Stop and drop the recording. */
  const cancel = useCallback(async () => {
    await halt();
    setPhase('idle');
    setElapsed(0);
  }, [halt]);

  /** Stop and transcribe; the text (or null, the error in `error`) goes to `onText`. */
  const finish = useCallback(async (): Promise<void> => {
    await halt();
    const uri = recorder.uri;
    let text: string | null = null;
    if (!client || !uri) {
      setPhase('idle');
      setError('Nothing was recorded.');
    } else {
      setPhase('transcribing');
      try {
        const file = await audioFileFor(uri, Platform.OS);
        const got = await client.transcribe(file, lang, purpose);
        text = (got.text || '').trim() || null;
        if (!text) setError('No speech was heard in that recording.');
      } catch (e) {
        setError(e instanceof ApiError ? voiceError(e.status, e.message) : 'The recording could not be transcribed.');
      }
      setPhase('idle');
    }
    onTextRef.current(text);
  }, [client, halt, lang, purpose, recorder]);

  useEffect(() => {
    finishRef.current = () => void finish();
  }, [finish]);

  return { phase, elapsed, error, setError, start, cancel, finish };
}
