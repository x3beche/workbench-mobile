/**
 * The Office screen: the web's own picture, hosted (docs/OFFICE.md, #a02107 for the page, #72cbd0 here).
 *
 * The app draws nothing of the office any more. It asks the server for a one-off ticket
 * (`POST /api/office/embed-token`, `backend/office_embed.py`), opens `/office/embed` with it in a header - never in
 * a URL, which a WebView keeps in its history - and hands the page its theme, its language and the phone's insets
 * (`lib/officeEmbed.ts`). What comes back is a tap on a character (`open`), whether the picture is drawn
 * (`ready`), the line for the bar (`state`), or that the page could not draw at all (`error`).
 *
 * The page polls for itself, and only while the app is in front: `pause`/`resume` go to it with `AppState`, so
 * nothing is drawn or asked for from the background (the resilience rules). Until the server has a page
 * (`ready: false`), the app's stand-in is drawn in its place - the same protocol, so the switch is the server's.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WorkbenchClient } from '../api/client';
import type { OfficeEmbed as OfficeTicket } from '../api/types';
import { OfficeEmbed } from '../components/OfficeEmbed';
import { useOfficeClock } from '../components/officeClock';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, LoadError } from '../components/ui';
import { helloOf, MOCK_EMBED_HTML, type PageMessage } from '../lib/officeEmbed';
import type { OfficeStrings } from '../lib/officeStrings';
import { colors, fonts, radius, space, theme, type } from '../theme/tokens';
import type { UiLang } from '../update/strings';

export function OfficeScreen({
  client,
  t,
  lang,
  wide = false,
  onMenu,
  onOpen,
}: {
  client: WorkbenchClient | null;
  t: OfficeStrings;
  /** The app's language, for the page (it speaks both). */
  lang: UiLang;
  wide?: boolean;
  /** The drawer's button (a phone); a wide screen keeps its column. */
  onMenu?: () => void;
  /** A character's session: `wbo:ses_…` or `wbc:ses_…`, as the page sent it. */
  onOpen: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { clock } = useOfficeClock();
  /** The ticket read once when the screen opens; a retry reads a new one. */
  const [ticket, setTicket] = useState<OfficeTicket | null>(null);
  const [loading, setLoading] = useState(true);
  /** The line the screen cannot do without (no ticket: offline, or the server refused), and a retry. */
  const [failed, setFailed] = useState<string | null>(null);
  /** The page says it could not draw: a line over the space, and a reload. */
  const [pageError, setPageError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ floor?: string; agents?: number } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [paused, setPaused] = useState(() => AppState.currentState !== 'active');
  /** A reload: a fresh ticket and a fresh page (the stand-in too). */
  const [generation, setGeneration] = useState(0);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const load = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(null);
    setPageError(null);
    setDrawn(false);
    try {
      const got = await client.officeEmbedToken();
      if (!alive.current) return;
      setTicket(got);
      setGeneration((n) => n + 1);
    } catch (e) {
      if (!alive.current) return;
      setFailed(e instanceof Error && e.message ? e.message : tRef.current.error);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    let gone = false;
    // After this turn, not during it: the read is the effect's.
    const began = async () => {
      await Promise.resolve();
      if (!gone) await load();
    };
    void began();
    return () => {
      gone = true;
    };
  }, [load]);

  // The page is frozen while the app is behind another one: nothing is drawn, nothing is asked for.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setPaused(st !== 'active'));
    return () => sub.remove();
  }, []);

  const hello = useMemo(
    () =>
      helloOf({
        theme: theme.light ? 'light' : 'dark',
        themeId: theme.id,
        lang,
        insets: {
          top: Math.round(insets.top),
          bottom: Math.round(insets.bottom),
          left: Math.round(insets.left),
          right: Math.round(insets.right),
        },
        server: client?.base ?? '',
      }),
    [client?.base, insets.bottom, insets.left, insets.right, insets.top, lang],
  );

  const hear = useCallback(
    (message: PageMessage) => {
      switch (message.type) {
        case 'ready':
          setDrawn(true);
          break;
        case 'open':
          onOpen(message.agent);
          break;
        case 'state':
          setStats({ ...(message.floor ? { floor: message.floor } : {}), ...(message.agents !== undefined ? { agents: message.agents } : {}) });
          break;
        case 'error':
          setPageError(message.message);
          break;
      }
    },
    [onOpen],
  );

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const page = ticket?.ready ? ticket : null;
  const uri = page?.url ? absoluteUrl(client?.base, page.url) : null;
  // The page says what it has: a floor and its agents, or nobody - and the person's own rule for that is to point
  // at where agents are pinned (the office is the pinned agents and their tree, never the whole account).
  const sub =
    stats && stats.agents === 0
      ? t.pinPrompt
      : stats?.floor
        ? `${t.summary(stats.floor, stats.agents ?? 0)}`
        : drawn
          ? t.readOnly
          : undefined;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="office-screen">
      <ScreenHeader
        title={t.office}
        onMenu={wide ? undefined : onMenu}
        menuTestID="office-open-drawer"
        menuLabel={t.office}
        sub={sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : undefined}
        right={
          <Text style={s.clock} testID="office-clock" accessibilityLabel={clock}>
            {clock}
          </Text>
        }
      />
      {loading ? (
        <View style={s.loading} testID="office-loading">
          <ActivityIndicator color={colors.inkDim} />
          <Text style={s.loadingText}>{t.loading}</Text>
        </View>
      ) : failed ? (
        <LoadError text={failed} onRetry={retry} retryLabel={t.retry} centered testID="office-error" />
      ) : (
        <View style={s.body}>
          <OfficeEmbed
            key={generation}
            testID="office-embed"
            uri={uri}
            {...(uri && page?.token ? { headers: { 'x-office-embed': page.token } } : {})}
            {...(uri ? {} : { html: MOCK_EMBED_HTML })}
            baseUrl={client?.base}
            hello={hello}
            paused={paused}
            onMessage={hear}
            onError={(why) => setPageError(why)}
          />
          {pageError ? (
            <View style={s.banner} testID="office-embed-error">
              <Text style={s.bannerText} numberOfLines={2}>
                {`${t.pageError} ${pageError}`}
              </Text>
              <Button label={t.retry} onPress={retry} testID="office-embed-retry" style={s.bannerGo} />
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

/** The page's address as the WebView should ask for it: the server's own, when the server sent a path. */
export function absoluteUrl(base: string | undefined, url: string): string {
  if (/^[a-z]+:/i.test(url) || url.startsWith('//')) return url;
  if (!base) return url;
  return base.replace(/\/+$/, '') + (url.startsWith('/') ? url : `/${url}`);
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1 },
  sub: {
    fontFamily: fonts.sans,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.inkDim,
  },
  clock: {
    marginLeft: space.sm,
    fontFamily: fonts.mono,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
    fontVariant: ['tabular-nums'],
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
  },
  banner: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.warnSoft,
  },
  bannerText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.warn,
  },
  bannerGo: { marginLeft: 'auto' },
});
