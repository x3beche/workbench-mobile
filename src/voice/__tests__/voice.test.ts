import {
  audioFileFor,
  formatDuration,
  langLabel,
  MAX_RECORD_MS,
  PERMISSION_DENIED,
  VOICE_LANGS,
  voiceError,
} from '../voice';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [7_000, '0:07'],
    [102_000, '1:42'],
    [723_500, '12:03'],
    [-5, '0:00'],
  ])('%i ms -> %s', (ms, want) => {
    expect(formatDuration(ms)).toBe(want);
  });
});

describe('limits and labels', () => {
  it('stops before the server limit of five minutes', () => {
    expect(MAX_RECORD_MS).toBeLessThan(300_000);
  });
  it('offers Auto, Türkçe and English', () => {
    expect(VOICE_LANGS.map((l) => l.id)).toEqual(['auto', 'tr', 'en']);
    expect(langLabel('tr')).toBe('Türkçe');
  });
  it('says how to allow the microphone', () => {
    expect(PERMISSION_DENIED).toMatch(/settings/i);
  });
});

describe('audioFileFor', () => {
  it('names a phone recording by its extension, as AAC in MP4', async () => {
    await expect(audioFileFor('file:///data/rec-1.m4a', 'android')).resolves.toEqual({
      uri: 'file:///data/rec-1.m4a',
      name: 'voice.m4a',
      type: 'audio/mp4',
    });
    await expect(audioFileFor('file:///x/rec.caf?v=1', 'ios')).resolves.toEqual({
      uri: 'file:///x/rec.caf?v=1',
      name: 'voice.caf',
      type: 'audio/caf',
    });
    await expect(audioFileFor('file:///x/rec.aac', 'android')).resolves.toMatchObject({ type: 'audio/aac' });
    await expect(audioFileFor('file:///x/noext', 'android')).resolves.toMatchObject({ name: 'voice.m4a' });
  });

  it('reads a browser recording into a blob', async () => {
    const webm = { type: 'audio/webm;codecs=opus' } as Blob;
    const fetchBlob = jest.fn(async () => webm);
    await expect(audioFileFor('blob:http://x/1', 'web', fetchBlob)).resolves.toEqual({
      blob: webm,
      name: 'voice.webm',
    });
    expect(fetchBlob).toHaveBeenCalledWith('blob:http://x/1');
    const mp4 = { type: 'audio/mp4' } as Blob;
    await expect(audioFileFor('blob:x', 'web', async () => mp4)).resolves.toEqual({ blob: mp4, name: 'voice.m4a' });
  });
});

describe('voiceError', () => {
  it('passes the server detail through', () => {
    expect(voiceError(400, 'too long')).toBe('too long');
  });
  it.each([
    [503, /not set up/],
    [502, /failed/],
    [400, /too long or unreadable/],
    [500, /could not be transcribed/],
  ])('has a sentence for %i without a detail', (status, want) => {
    expect(voiceError(status, '')).toMatch(want);
  });
});
