/**
 * The Office, hosted: the web's own embed page in a WebView (docs/OFFICE.md, #a02107 for the page, #72cbd0 for
 * the phone). The app draws none of it - it hands the page the theme, the language and the safe-area insets, hears
 * `ready` / `open` / `error` back (lib/officeEmbed.ts), and freezes the page while it is behind another app.
 *
 * The page is the server's: `uri` with the one-off ticket in a header (`x-office-embed`, never in the URL). Until
 * the page lands, `html` carries the app's stand-in, and the switch is the server's answer, not the app's build.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { PAGE_HOOK, pageMessageOf, type PageMessage } from '../lib/officeEmbed';

export interface OfficeEmbedProps {
  /** The page's address, when the server has one; null for the stand-in. */
  uri: string | null;
  /** What the page is loaded with: the one-off ticket, in a header (a URL would keep it in history). */
  headers?: Record<string, string>;
  /** The stand-in page, when there is no `uri` yet. */
  html?: string;
  /** Where the page's relative addresses point (the server), for the stand-in's own loads. */
  baseUrl?: string;
  /** What to tell the page: theme, language, insets, server (JSON, one `hello`). */
  hello: string;
  /** The app is behind another one: the page stops drawing and polling. */
  paused: boolean;
  onMessage: (message: PageMessage) => void;
  /** The page did not load at all (no network, a refused connection, an HTTP error). */
  onError: (why: string) => void;
  testID?: string;
}

export function OfficeEmbed({
  uri,
  headers,
  html,
  baseUrl,
  hello,
  paused,
  onMessage,
  onError,
  testID,
}: OfficeEmbedProps) {
  const ref = useRef<WebView>(null);

  /** Say something to the page, once it is there (the hook is the page's own; a page without it is fine). */
  const tell = (message: string) => {
    ref.current?.injectJavaScript?.(`window.${PAGE_HOOK} && window.${PAGE_HOOK}(${JSON.stringify(message)});true;`);
  };

  useEffect(() => {
    tell(hello);
  }, [hello]);

  useEffect(() => {
    tell(JSON.stringify({ type: paused ? 'pause' : 'resume' }));
  }, [paused]);

  return (
    <WebView
      ref={ref}
      testID={testID}
      source={uri ? { uri, ...(headers ? { headers } : {}) } : { html: html ?? '', baseUrl }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      // The bridge: the page's postMessage arrives here as a string.
      onMessage={(e: WebViewMessageEvent) => {
        const got = pageMessageOf(e.nativeEvent.data);
        if (got) onMessage(got);
      }}
      onError={(e) => onError(e.nativeEvent.description || 'The office could not be opened.')}
      onHttpError={(e) => onError(`The office page answered HTTP ${e.nativeEvent.statusCode}.`)}
      style={s.web}
      containerStyle={s.web}
    />
  );
}

const s = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
});
