/**
 * Record a voice message and turn it into text with the server.
 * idle -> recording -> transcribing -> idle (with the text) or error.
 * Nothing is sent by this hook: the text goes to whoever asked for it.
 *
 * Live (the Account sheet's "Words appear: Live"): the microphone's PCM
 * streams to the server's own Whisper while it records (voice/live.ts), and
 * `live` holds the settled words and the unsure tail to show meanwhile; at
 * the end the server's whole text is the result. The same microphone writes
 * a WAV, so when the server does not offer live words (an older server, the
 * service down or busy) or they break, that recording is written out the
 * old way (POST /api/voice/transcribe). Where there is no such microphone
 * (Expo Go, a browser without Web Audio) expo-audio records, as before.
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

import { ApiError, type AudioFile, type VoiceLang, type WorkbenchClient } from '../api/client';
import { LiveSession, liveUrl, sayNoLiveOnce } from './live';
import { forgetRecording, openPcmMic, type PcmMic } from './pcmMic';
import {
  audioFileFor,
  LIVE_BROKE,
  MAX_RECORD_MS,
  NO_LIVE,
  PERMISSION_DENIED,
  voiceError,
  type VoiceMode,
} from './voice';

export type VoicePhase = 'idle' | 'recording' | 'transcribing';

/** The live words while speaking: settled ones (ink) and the tail that may still change (dimmed). */
export interface LiveWords {
  settled: string;
  tail: string;
}

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
  mode: VoiceMode = 'record',
) {
  const recorder = useAudioRecorder(OPTIONS);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** A word about the live path (not there, stopped): not an error, the recording goes on. */
  const [notice, setNotice] = useState<string | null>(null);
  const [live, setLive] = useState<LiveWords | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<() => void>(() => undefined);
  const onTextRef = useRef(onText);
  /** The PCM microphone while it records (live mode), else expo-audio's recorder is the one. */
  const mic = useRef<PcmMic | null>(null);
  const session = useRef<LiveSession | null>(null);
  useEffect(() => {
    onTextRef.current = onText;
  });

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      clearTimer();
      session.current?.close();
      session.current = null;
      void mic.current?.cancel();
      mic.current = null;
    },
    [],
  );

  /** The PCM microphone with the live stream on it, or null (none here: record the old way). */
  const startLive = useCallback(async (): Promise<boolean> => {
    if (mode !== 'live' || !client) return false;
    const lv = new LiveSession(
      liveUrl(client.base),
      { lang, purpose },
      {
        words: (settled, tail) => setLive({ settled, tail }),
        broke: () => setNotice(LIVE_BROKE),
      },
    );
    let pcm: PcmMic;
    try {
      pcm = await openPcmMic((bytes) => lv.push(bytes));
    } catch {
      return false;
    }
    mic.current = pcm;
    session.current = lv;
    void lv.open().then((r) => {
      if (session.current !== lv) return; // stopped or thrown away meanwhile
      if (r.ok) setLive({ settled: '', tail: '' });
      else {
        session.current = null;
        lv.close();
        if (sayNoLiveOnce()) setNotice(NO_LIVE);
      }
    });
    return true;
  }, [client, lang, mode, purpose]);

  const start = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      setError(null);
      setNotice(null);
      setLive(null);
      if (!perm.granted) {
        setError(PERMISSION_DENIED);
        return false;
      }
      if (!(await startLive())) {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (e) {
      setError(
        e instanceof Error && /permission|denied|notallowed/i.test(e.message)
          ? PERMISSION_DENIED
          : 'The microphone could not be started.',
      );
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
  }, [recorder, startLive]);

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
    session.current?.close();
    session.current = null;
    const pcm = mic.current;
    mic.current = null;
    if (pcm) {
      clearTimer();
      await pcm.cancel().catch(() => undefined);
    } else await halt();
    setLive(null);
    setPhase('idle');
    setElapsed(0);
  }, [halt]);

  /** A recording written out by the server's voice job: the text, or null with the reason in `error`. */
  const upload = useCallback(
    async (file: AudioFile): Promise<string | null> => {
      if (!client) return null;
      try {
        const got = await client.transcribe(file, lang, purpose);
        const text = (got.text || '').trim() || null;
        if (!text) setError('No speech was heard in that recording.');
        return text;
      } catch (e) {
        setError(e instanceof ApiError ? voiceError(e.status, e.message) : 'The recording could not be transcribed.');
        return null;
      }
    },
    [client, lang, purpose],
  );

  /** Live: the server's last words and whole text - or, when that is not there, the WAV written out. */
  const finishPcm = useCallback(
    async (pcm: PcmMic): Promise<string | null> => {
      const lv = session.current;
      session.current = null;
      let file: AudioFile | null = null;
      try {
        file = await pcm.stop();
      } catch {
        file = null;
      }
      setPhase('transcribing');
      const done = lv?.live ? await lv.finish() : null;
      lv?.close();
      let text: string | null = null;
      if (done) {
        text = (done.text || '').trim() || null;
        if (!text) setError('No speech was heard in that recording.');
        else if (done.reason === 'limit') setNotice('Stopped at 5 minutes, the most a recording takes.');
      } else if (file && client) {
        text = await upload(file);
      } else {
        setError('Nothing was recorded.');
      }
      if (file) forgetRecording(file);
      return text;
    },
    [client, upload],
  );

  /** Stop and transcribe; the text (or null, the error in `error`) goes to `onText`. */
  const finish = useCallback(async (): Promise<void> => {
    let text: string | null = null;
    const pcm = mic.current;
    mic.current = null;
    if (pcm) {
      clearTimer();
      text = await finishPcm(pcm);
      setLive(null);
      setPhase('idle');
    } else {
      await halt();
      const uri = recorder.uri;
      if (!client || !uri) {
        setPhase('idle');
        setError('Nothing was recorded.');
      } else {
        setPhase('transcribing');
        try {
          text = await upload(await audioFileFor(uri, Platform.OS));
        } catch {
          setError('The recording could not be transcribed.');
        }
        setPhase('idle');
      }
    }
    onTextRef.current(text);
  }, [client, finishPcm, halt, recorder, upload]);

  useEffect(() => {
    finishRef.current = () => void finish();
  }, [finish]);

  return { phase, elapsed, error, setError, notice, setNotice, live, start, cancel, finish };
}
