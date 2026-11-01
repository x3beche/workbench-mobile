/**
 * The Office's embed protocol (lib/officeEmbed.ts): the four messages a page may send, the one the app sends it,
 * and the stand-in page - which speaks the same protocol, so switching to the web's own page changes nothing in
 * the app.
 */
import { helloOf, MOCK_EMBED_HTML, PAGE_HOOK, pageMessageOf } from '../officeEmbed';
import { absoluteUrl } from '../../screens/OfficeScreen';

describe('what the page may say', () => {
  it('hears ready, the bar’s line, a tap, and a failure', () => {
    expect(pageMessageOf(JSON.stringify({ type: 'ready' }))).toEqual({ type: 'ready' });
    expect(pageMessageOf(JSON.stringify({ type: 'state', floor: ' Ground floor ', agents: 4.7 }))).toEqual({
      type: 'state', floor: 'Ground floor', agents: 4,
    });
    expect(pageMessageOf(JSON.stringify({ type: 'state' }))).toEqual({ type: 'state' });
    expect(pageMessageOf(JSON.stringify({ type: 'open', agent: ' wbo:ses_04f1 ' }))).toEqual({
      type: 'open', agent: 'wbo:ses_04f1',
    });
    expect(pageMessageOf(JSON.stringify({ type: 'error', message: 'no rooms' }))).toEqual({
      type: 'error', message: 'no rooms',
    });
    // A failure with no words still has to say something a person can read.
    expect(pageMessageOf(JSON.stringify({ type: 'error' }))).toEqual({
      type: 'error', message: 'The office could not be drawn.',
    });
  });

  it('ignores anything else - a newer page may say more than this one knows', () => {
    expect(pageMessageOf('not json')).toBeNull();
    expect(pageMessageOf('')).toBeNull();
    expect(pageMessageOf(null)).toBeNull();
    expect(pageMessageOf(42)).toBeNull();
    expect(pageMessageOf(JSON.stringify({ type: 'weather' }))).toBeNull();
    expect(pageMessageOf(JSON.stringify({ type: 'open' }))).toBeNull();          // no agent: nothing to open
    expect(pageMessageOf(JSON.stringify({ type: 'open', agent: '  ' }))).toBeNull();
    expect(pageMessageOf(JSON.stringify({ type: 'state', agents: 'many' }))).toEqual({ type: 'state' });
  });
});

describe('what the app says', () => {
  it('is one hello: the theme, the language, the insets and the server', () => {
    const line = helloOf({
      theme: 'light', themeId: 'light', lang: 'tr',
      insets: { top: 47, bottom: 34, left: 0, right: 0 }, server: 'https://office.example',
    });
    expect(JSON.parse(line)).toEqual({
      type: 'hello', theme: 'light', themeId: 'light', lang: 'tr',
      insets: { top: 47, bottom: 34, left: 0, right: 0 }, server: 'https://office.example',
    });
  });

  it('asks the page for an address on the server when it gave a path', () => {
    expect(absoluteUrl('https://o.example', '/office/embed')).toBe('https://o.example/office/embed');
    expect(absoluteUrl('https://o.example/', 'office/embed')).toBe('https://o.example/office/embed');
    expect(absoluteUrl('https://o.example', 'https://other.example/x')).toBe('https://other.example/x');
    expect(absoluteUrl(undefined, '/office/embed')).toBe('/office/embed');
  });
});

describe('the stand-in page', () => {
  it('speaks the whole protocol: the hook, ready, the bar’s line, a tap, and the freeze', () => {
    expect(MOCK_EMBED_HTML).toContain(`var HOOK = '${PAGE_HOOK}'`);     // the name the WebView injects through
    expect(MOCK_EMBED_HTML).toContain('window[HOOK] = function');
    expect(MOCK_EMBED_HTML).toContain("type: 'ready'");
    expect(MOCK_EMBED_HTML).toContain("type: 'state'");
    expect(MOCK_EMBED_HTML).toContain("type: 'open'");
    expect(MOCK_EMBED_HTML).toContain("m.type === 'hello'");
    expect(MOCK_EMBED_HTML).toContain("m.type === 'pause'");
    expect(MOCK_EMBED_HTML).toContain("m.type === 'resume'");
    // It says what it is, plainly, under the picture.
    expect(MOCK_EMBED_HTML).toContain('Stand-in until the web embed lands');
  });
});
