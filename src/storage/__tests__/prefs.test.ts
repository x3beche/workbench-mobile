import AsyncStorage from '@react-native-async-storage/async-storage';

import * as prefs from '../prefs';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('recent servers', () => {
  it('keeps the newest first, without duplicates, at most five', async () => {
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) await prefs.rememberServer(`https://${s}.example`);
    await prefs.rememberServer('https://c.example');
    expect(await prefs.recentServers()).toEqual([
      'https://c.example',
      'https://f.example',
      'https://e.example',
      'https://d.example',
      'https://b.example',
    ]);
  });

  it('forgets one, and the current server with it', async () => {
    await prefs.rememberServer('https://a.example');
    await prefs.rememberServer('https://b.example');
    await prefs.setCurrentServer('https://a.example');
    expect(await prefs.forgetServer('https://a.example')).toEqual(['https://b.example']);
    expect(await prefs.currentServer()).toBeNull();
  });

  it('keeps the current server when another is forgotten', async () => {
    await prefs.setCurrentServer('https://a.example');
    await prefs.forgetServer('https://b.example');
    expect(await prefs.currentServer()).toBe('https://a.example');
  });

  it('survives junk in storage', async () => {
    await AsyncStorage.setItem('workbench.servers', '{"not":"a list"}');
    expect(await prefs.recentServers()).toEqual([]);
    await AsyncStorage.setItem('workbench.servers', '[1, "https://ok.example", null]');
    expect(await prefs.recentServers()).toEqual(['https://ok.example']);
    await AsyncStorage.setItem('workbench.servers', 'not json');
    expect(await prefs.recentServers()).toEqual([]);
  });

  it('withServerFirst is pure', () => {
    const list = ['x', 'y'];
    expect(prefs.withServerFirst(list, 'y')).toEqual(['y', 'x']);
    expect(list).toEqual(['x', 'y']);
  });
});

describe('emails and voice language', () => {
  it('remembers the email per server', async () => {
    expect(await prefs.lastEmail('https://a.example')).toBe('');
    await prefs.rememberEmail('https://a.example', 'ada@a.example');
    await prefs.rememberEmail('https://b.example', 'bob@b.example');
    expect(await prefs.lastEmail('https://a.example')).toBe('ada@a.example');
    expect(await prefs.lastEmail('https://b.example')).toBe('bob@b.example');
  });

  it('never stores a password', async () => {
    await prefs.rememberServer('https://a.example');
    await prefs.rememberEmail('https://a.example', 'ada@a.example');
    const keys = await AsyncStorage.getAllKeys();
    const values = await AsyncStorage.multiGet(keys);
    expect(JSON.stringify(values).toLowerCase()).not.toContain('password');
  });

  it('defaults the voice language to auto and keeps a choice', async () => {
    expect(await prefs.voiceLang()).toBe('auto');
    await prefs.setVoiceLang('tr');
    expect(await prefs.voiceLang()).toBe('tr');
    await AsyncStorage.setItem('workbench.voiceLang', '"de"');
    expect(await prefs.voiceLang()).toBe('auto');
  });
});
