/**
 * The app's Turkish: the words a reader sees most - the drawer, Files, a
 * conversation, the workspace's dialogs - and the times and sizes beside them.
 * English is the key, so a table that forgot a word would read English here.
 */
import { chatStrings } from '../chatStrings';
import { drawerStrings } from '../drawerStrings';
import { countIn, plural, size, type FilesData } from '../files';
import { filesStrings } from '../filesStrings';
import { greeting, rowTime } from '../groups';
import { roomName } from '../rooms';
import { ago, shortTime } from '../time';
import { workspaceStrings } from '../workspaceStrings';
import type { Chat } from '../../api/types';

const WED = new Date(2026, 9, 14, 15, 30, 0);
const ago_ = (ms: number) => new Date(WED.getTime() - ms).toISOString();

describe('times in Turkish', () => {
  it('says now, minutes and hours its own way', () => {
    expect(shortTime(ago_(10_000), WED, 'tr')).toBe('şimdi');
    expect(shortTime(ago_(5 * 60_000), WED, 'tr')).toBe('5dk');
    expect(shortTime(ago_(3 * 3600_000), WED, 'tr')).toBe('3sa');
  });

  it('names the day and the month in Turkish', () => {
    expect(shortTime(new Date(2026, 9, 13, 20).toISOString(), WED, 'tr')).toBe('dün');
    expect(shortTime(new Date(2026, 9, 12).toISOString(), WED, 'tr')).toBe('Pzt');
    expect(shortTime(new Date(2026, 9, 1).toISOString(), WED, 'tr')).toBe('1 Eki');
  });

  it('counts back in Turkish', () => {
    expect(ago(ago_(30_000), WED, 'tr')).toBe('az önce');
    expect(ago(ago_(30 * 60_000), WED, 'tr')).toBe('30 dk önce');
    expect(ago(ago_(3 * 3600_000), WED, 'tr')).toBe('3 sa önce');
  });

  it('greets by the hour', () => {
    expect(greeting(WED, 'tr')).toBe('İyi günler');
  });

  it('puts a conversation in its group with the language it is read in', () => {
    const chat = { id: 'c', title: 't', updated_at: ago_(20 * 3600_000) } as Chat;
    expect(rowTime(chat, 'Yesterday', WED, 'tr')).toMatch(/^\d\d:\d\d$/);
  });
});

describe('numbers and sizes', () => {
  it('takes no plural suffix after a number', () => {
    expect(plural(3, 'klasör', 'tr')).toBe('3 klasör');
    expect(plural(1, 'klasör', 'tr')).toBe('1 klasör');
    expect(plural(3, 'folder')).toBe('3 folders');
  });

  it('writes a size with a comma', () => {
    expect(size(2048, 'tr')).toBe('2,0 kB');
    expect(size(2048, 'en')).toBe('2.0 kB');
  });

  it('counts a folder in Turkish', () => {
    const data = {
      files: [
        { id: 'a', name: 'a.txt', folder: 'f', bytes: 10 },
        { id: 'b', name: 'b.txt', folder: 'f', bytes: 10 },
      ],
      folders: [{ id: 'f', name: 'Belgeler' }],
      tree: null,
    } as unknown as FilesData;
    expect(countIn(data, 'mine', 'f', undefined, 'tr')).toBe('2 dosya');
    expect(countIn(data, 'mine', 'f', undefined, 'en')).toBe('2 files');
  });
});

describe('the words of each room', () => {
  it('names the rooms in Turkish', () => {
    expect(roomName('cad', 'tr')).toBe('3B Çizim');
    expect(roomName('cad', 'en')).toBe('3D Drawing');
  });

  it('groups the drawer in Turkish', () => {
    expect(drawerStrings('tr').groups.Today).toBe('Bugün');
    expect(drawerStrings('tr').newLines(3)).toBe('3 yeni');
    expect(drawerStrings('en').newLines(3)).toBe('3 new');
  });

  it('says a page of a PDF in Turkish', () => {
    expect(filesStrings('tr').pageOf(1, 3)).toBe('Sayfa 1 / 3');
    expect(filesStrings('en').pageOf(1, 3)).toBe('Page 1 of 3');
  });

  it('puts a code block in Turkish', () => {
    expect(chatStrings('tr').markdown.copy).toBe('Kopyala');
    expect(chatStrings('tr').retry).toBe('Yeniden dene');
  });

  it('tells what a bulk action did, and what stayed', () => {
    expect(workspaceStrings('tr').bulk('delete', 2, 0)).toEqual({ text: '2 Çöp’e taşındı', bad: false });
    expect(workspaceStrings('tr').bulk('delete', 2, 1)).toEqual({
      text: '2 Çöp’e taşındı; bir sohbet ulaşılamadı ve yerinde kaldı.',
      bad: true,
    });
    expect(workspaceStrings('en').bulk('delete', 1, 0).text).toBe('1 moved to Trash');
  });
});
