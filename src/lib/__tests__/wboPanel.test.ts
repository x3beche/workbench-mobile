/**
 * The folder under a session's name (lib/wboPanel.ts `titleDir`): read from its start, and a deeper one gives
 * way in the middle - the project and the folder the session is in, as the web's title bar writes it
 * (redline-studio f80e4af, opencode-sessions.ts `dirShort`).
 */
import { wboStrings } from '../wboStrings';
import { recentTitle, titleDir } from '../wboPanel';

describe('titleDir', () => {
  it('leaves a short folder as it is', () => {
    expect(titleDir('~/sensor')).toBe('~/sensor');
    expect(titleDir('~/projects/sensor-board')).toBe('~/projects/sensor-board');
    expect(titleDir('')).toBe('');
    expect(titleDir('~')).toBe('~');
    expect(titleDir('~/sensor/')).toBe('~/sensor');
  });

  it('gives way in the middle and keeps the project and the folder, from the start', () => {
    expect(titleDir('~/projects/redline-studio/frontend/src/app')).toBe('~/…/redline-studio/app');
    expect(titleDir('/home/x3/projects/redline-studio/rooms')).toBe('~/…/redline-studio/rooms');
    expect(titleDir('/var/lib/workbench/build/output')).toBe('…/build/output');
  });

  it('says a home of one name as ~', () => {
    expect(titleDir('/home/x3')).toBe('~');
  });
});

describe('recentTitle', () => {
  const en = wboStrings('en');
  const call = { tool: 'shell', cat: 'shell', title: 'npm test', status: 'completed', start: 1, end: 2, part: 'm' };

  it('says what ran, and the calls a chained one carried', () => {
    expect(recentTitle(call, en)).toBe('npm test');
    expect(recentTitle({ ...call, more: 2 }, en)).toBe('npm test (2 commands)');
  });

  it('falls back to the tool when it has no title', () => {
    expect(recentTitle({ ...call, title: '' }, en)).toBe('shell');
  });
});
