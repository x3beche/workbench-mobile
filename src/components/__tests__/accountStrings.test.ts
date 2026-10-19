import { VOICE_LANGS, VOICE_MODES } from '../../voice/voice';
import { accountStrings, localized } from '../accountStrings';

test('Account speaks Turkish when the UI is Turkish', () => {
  const t = accountStrings('tr');
  expect(t.server).toBe('Sunucu');
  expect(t.signOut).toBe('Çıkış yap');
  expect(localized(VOICE_LANGS, t).map((o) => o.label)).toEqual(['Otomatik', 'Türkçe', 'English']);
  expect(localized(VOICE_MODES, t).map((o) => o.label)).toEqual(['Konuşurken', 'Kayıt bitince']);
});

test('English keeps the labels as they are', () => {
  const t = accountStrings('en');
  expect(localized(VOICE_MODES, t)).toEqual(VOICE_MODES);
  expect(t.wordsAppear).toBe('Words appear');
});
