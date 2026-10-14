/**
 * Turning what someone typed into a server address the app can talk to.
 *
 * "redline.example.com", "https://redline.example.com/", and
 * "https://redline.example.com/chat" all mean the same Workbench install.
 * Plain http is kept when it is asked for (a server on the local network),
 * and assumed for localhost and private addresses typed without a scheme;
 * anything else defaults to https.
 */
export class ServerAddressError extends Error {}

const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\]|[^.]+\.local)$/i;

export function normalizeServer(input: string): string {
  let text = input.trim();
  if (!text) throw new ServerAddressError('Enter the address of a Workbench server.');
  if (/\s/.test(text)) throw new ServerAddressError('A server address has no spaces.');
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  if (hasScheme && !/^https?:\/\//i.test(text)) {
    throw new ServerAddressError('Only http and https addresses are supported.');
  }
  if (!hasScheme) {
    const host = text.split(/[/:?#]/)[0];
    text = (PRIVATE_HOST.test(host) ? 'http://' : 'https://') + text;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new ServerAddressError('That does not look like a web address.');
  }
  if (!url.hostname) throw new ServerAddressError('That does not look like a web address.');
  // The API lives at the root of the install: whatever path was pasted
  // (a page of the web app, say) is dropped.
  const port = url.port ? `:${url.port}` : '';
  return `${url.protocol}//${url.hostname.toLowerCase()}${port}`;
}

/** The address as people read it: no scheme when it is https. */
export function displayServer(base: string): string {
  return base.replace(/^https:\/\//, '');
}
