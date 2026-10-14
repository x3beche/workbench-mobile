import { displayServer, normalizeServer, ServerAddressError } from '../server';

describe('normalizeServer', () => {
  it('assumes https for a public host typed without a scheme', () => {
    expect(normalizeServer('redline.example.com')).toBe('https://redline.example.com');
  });

  it('keeps an explicit http or https scheme', () => {
    expect(normalizeServer('http://redline.example.com')).toBe('http://redline.example.com');
    expect(normalizeServer('HTTPS://Redline.Example.com')).toBe('https://redline.example.com');
  });

  it('drops a pasted path, query, fragment and trailing slash', () => {
    expect(normalizeServer('https://redline.example.com/')).toBe('https://redline.example.com');
    expect(normalizeServer('https://redline.example.com/chat?x=1#top')).toBe('https://redline.example.com');
    expect(normalizeServer('  redline.example.com/rooms/cc  ')).toBe('https://redline.example.com');
  });

  it('keeps a port', () => {
    expect(normalizeServer('https://redline.example.com:8443/x')).toBe('https://redline.example.com:8443');
  });

  it.each([
    ['localhost:8000', 'http://localhost:8000'],
    ['127.0.0.1:4200', 'http://127.0.0.1:4200'],
    ['10.0.0.5', 'http://10.0.0.5'],
    ['192.168.1.20:8080', 'http://192.168.1.20:8080'],
    ['172.16.3.4', 'http://172.16.3.4'],
    ['workbench.local', 'http://workbench.local'],
  ])('uses http for the private address %s', (typed, want) => {
    expect(normalizeServer(typed)).toBe(want);
  });

  it('does not treat 172.32.x.x as private', () => {
    expect(normalizeServer('172.32.0.1')).toBe('https://172.32.0.1');
  });

  it.each([[''], ['   '], ['red line.example.com'], ['ftp://example.com'], ['ws://example.com'], ['https://']])(
    'refuses %p',
    (typed) => {
      expect(() => normalizeServer(typed)).toThrow(ServerAddressError);
    },
  );
});

describe('displayServer', () => {
  it('hides https but not http', () => {
    expect(displayServer('https://redline.example.com')).toBe('redline.example.com');
    expect(displayServer('http://10.0.0.5:8000')).toBe('http://10.0.0.5:8000');
  });
});
