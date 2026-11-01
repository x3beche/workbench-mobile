/**
 * The Office, hosted on the web build: the same page in an iframe. A browser cannot put a header on an iframe, so
 * the real page (`uri`) is the server's own address and travels with the browser's session cookie; the stand-in
 * (`html`) goes in as `srcDoc`. The bridge is `window.postMessage`, the same four messages (lib/officeEmbed.ts).
 *
 * This is how the screenshots are taken (a browser has no WebView): the host, the bridge and the page are the
 * same ones the phone runs.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { PAGE_HOOK, pageMessageOf, type PageMessage } from '../lib/officeEmbed';

export interface OfficeEmbedProps {
  uri: string | null;
  headers?: Record<string, string>;
  html?: string;
  baseUrl?: string;
  hello: string;
  paused: boolean;
  onMessage: (message: PageMessage) => void;
  onError: (why: string) => void;
  testID?: string;
}

export function OfficeEmbed({ uri, html, hello, paused, onMessage, onError, testID }: OfficeEmbedProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const hear = (ev: MessageEvent) => {
      const data = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data);
      const got = pageMessageOf(data);
      if (got) onMessage(got);
    };
    window.addEventListener('message', hear);
    return () => window.removeEventListener('message', hear);
  }, [onMessage]);

  /** The page's own hook, called in its window (the same call the WebView injects). */
  const tell = (message: string) => {
    const win = ref.current?.contentWindow as (Window & Record<string, unknown>) | null | undefined;
    const hook = win?.[PAGE_HOOK] as ((m: string) => void) | undefined;
    if (typeof hook === 'function') hook(message);
  };

  useEffect(() => {
    tell(hello);
  }, [hello]);

  useEffect(() => {
    tell(JSON.stringify({ type: paused ? 'pause' : 'resume' }));
  }, [paused]);

  return (
    <View style={s.wrap} testID={testID}>
      <iframe
        ref={ref}
        title="Office"
        {...(uri ? { src: uri } : { srcDoc: html ?? '' })}
        onError={() => onError('The office page could not be opened.')}
        style={{ border: 'none', width: '100%', height: '100%', background: 'transparent' }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
});
