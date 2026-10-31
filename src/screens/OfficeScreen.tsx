/**
 * The Office screen: the read-only, top-down view of the company (docs/OFFICE.md,
 * phase 4) and the data behind it.
 *
 * `GET /api/office` is read once, when the screen opens (the layout does not
 * move by itself); `GET /api/office/live` is polled at the pace the server asks
 * for (`live_s`, ten seconds unless it says otherwise), and at once when the
 * account's bus says the picture changed (`office`). Neither happens while the
 * app is in the background (the resilience rules): `inFront()` is asked before
 * every request, and drawing stops with the app.
 *
 * Nothing here writes: there is no drag of a chair, no new room, no task
 * closed from the picture. The one thing a tap does is open the session behind
 * the character - the same read the drawer does.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WorkbenchClient } from '../api/client';
import type { OfficeLayout, OfficeLiveAgent } from '../api/types';
import { OfficeView } from '../components/OfficeView';
import { ScreenHeader } from '../components/ScreenHeader';
import { LoadError } from '../components/ui';
import { floorOf } from '../lib/office/scene';
import type { OfficeStrings } from '../lib/officeStrings';
import { inFront } from '../live/hub';
import { useBus } from '../live/LiveContext';
import { colors, fonts, space, type } from '../theme/tokens';

/** How often the live rows are asked for when the server does not say (seconds). */
const SLOW_S = 10;
const FASTEST_S = 5;
const SLOWEST_S = 60;

export function OfficeScreen({
  client,
  t,
  wide = false,
  onMenu,
  onOpen,
}: {
  client: WorkbenchClient | null;
  t: OfficeStrings;
  wide?: boolean;
  /** The drawer's button (a phone); a wide screen keeps its column. */
  onMenu?: () => void;
  /** A character's session: `wbo:ses_…` or `wbc:ses_…`. */
  onOpen: (key: string) => void;
}) {
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [agents, setAgents] = useState<OfficeLiveAgent[] | null>(null);
  /** The pace the server asked for, in a ref: the loop reads it after each answer, and does not restart. */
  const everyS = useRef(SLOW_S);
  /** Why the floor could not be read (the screen is empty), and why the last live read failed (a banner). */
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const alive = useRef(true);
  const busy = useRef(false);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const load = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }
    try {
      const got = await client.office();
      if (!alive.current) return;
      setLayout(got);
      setLayoutError(null);
    } catch (e) {
      if (!alive.current) return;
      setLayoutError(e instanceof Error && e.message ? e.message : tRef.current.error);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    let gone = false;
    // After this turn, not during it: the read is the effect's, and its answers are the effect's.
    const began = async () => {
      await Promise.resolve();
      if (!gone) await load();
    };
    void began();
    return () => {
      gone = true;
    };
  }, [load]);

  const fetchLive = useCallback(async () => {
    if (!client || busy.current) return;
    busy.current = true;
    try {
      const got = await client.officeLive();
      if (!alive.current) return;
      setAgents(Array.isArray(got?.agents) ? got.agents : []);
      everyS.current = Math.max(FASTEST_S, Math.min(SLOWEST_S, Math.round(got?.live_s || SLOW_S)));
      setLiveError(null);
    } catch (e) {
      if (!alive.current) return;
      setLiveError(e instanceof Error && e.message ? e.message : tRef.current.error);
    } finally {
      busy.current = false;
    }
  }, [client]);

  // The poll: a request, then a rest of the server's own length; nothing while
  // the app is behind another one. Restarting it (a new pace) asks once more.
  useEffect(() => {
    let go = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      if (!go) return;
      if (inFront()) await fetchLive();
      if (go) timer = setTimeout(loop, everyS.current * 1000);
    };
    void loop();
    return () => {
      go = false;
      if (timer) clearTimeout(timer);
    };
  }, [fetchLive]);

  // The bus says some agent's picture changed: read it now, not at the next tick.
  useBus(['office'], () => {
    void fetchLive();
  });

  const floor = useMemo(() => floorOf(layout), [layout]);
  const count = agents?.length ?? 0;
  const sub = layout ? `${t.summary(floor?.name || t.office, count)} · ${t.readOnly}` : undefined;

  const retry = useCallback(() => {
    setLoading(true);
    setLayoutError(null);
    setLiveError(null);
    void load().then(() => fetchLive());
  }, [load, fetchLive]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="office-screen">
      <ScreenHeader
        title={t.office}
        onMenu={wide ? undefined : onMenu}
        menuTestID="office-open-drawer"
        menuLabel={t.office}
        sub={sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : undefined}
      />
      {!layout && loading ? (
        <View style={s.loading} testID="office-loading">
          <ActivityIndicator color={colors.inkDim} />
          <Text style={s.loadingText}>{t.loading}</Text>
        </View>
      ) : !layout ? (
        <LoadError text={layoutError || t.error} onRetry={retry} retryLabel={t.retry} centered testID="office-error" />
      ) : (
        <View style={s.body}>
          <OfficeView layout={layout} live={agents} t={t} onOpen={onOpen} wide={wide} />
          {liveError ? (
            <View style={s.banner} testID="office-live-error">
              <Text style={s.bannerText} numberOfLines={2}>
                {liveError}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
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
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.warnSoft,
  },
  bannerText: {
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.warn,
  },
});
