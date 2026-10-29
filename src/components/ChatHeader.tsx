/**
 * The bar every conversation is read under - Chat, one of the rooms, a Claude
 * session, an OpenCode session. One bar for all four, so they read as one
 * app: the drawer button on the left, the conversation's name in the middle
 * with what it is doing (or the model) under it, its own buttons on the
 * right (closing it, or the chat's more and new).
 *
 * The middle turns: swiping it sideways slides the name out and the
 * account's live Activity (components/Activity) in from the other side;
 * swipe again and the name comes back - and again, for as long as one keeps
 * swiping, because the pair loops. It follows the finger; let go before half
 * the width and it goes back where it was. A tap turns it too, for whoever
 * does not think of swiping (a screen reader cannot swipe the bar).
 *
 * The bar never changes height and the conversation under it never jumps. The
 * name turns inside the middle, between the drawer button and the bar's own
 * buttons; the activity is wider than that middle and comes in over the whole
 * bar - buttons and all - so what the person ticked in the sheet has room.
 *
 * The swipe is a gesture-handler pan that blocks the drawer's own swipe to
 * the right (DrawerPull), which would otherwise pull the drawer out from
 * under the same finger. Transform only, on the UI thread
 * (react-native-reanimated).
 */
import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { useMaybeSession } from '../state/session';
import { chromeStrings } from '../lib/chromeStrings';
import { colors, fonts, motion, space, touch, type } from '../theme/tokens';
import { uiLang } from '../update/strings';
import { ActivityStrip } from './Activity';
import { DrawerPull } from './drawerGestures';
import { Menu } from './icons';
import { useReduceMotion } from './motion';
import { IconButton } from './ui';

/** How far the finger goes sideways before the bar is a swipe rather than a tap. */
const SLOP = 16;
/** A flick at least this fast (px/s) turns the bar whatever its position. */
const FLICK = 400;
/** Let go slower than this flick, and the turn is kept only if this much of the page was covered. */
const HELD = 0.35;

/** Where one page of the pair sits: the one leaving slides away to `dir`,
 *  the one coming in waits on the other side; `p` is how far the turn got. */
function pageX(page: number, from: number, to: number, dir: number, p: number, span: number): number {
  'worklet';
  if (from === to) return page === from ? 0 : dir * span;
  return page === to ? dir * (p - 1) * span : dir * p * span;
}

export function ChatHeader({
  title,
  sub,
  icon,
  left,
  right,
  below,
  wide = false,
  onMenu,
  menuLabel = 'Open the conversations',
  menuTestID = 'open-drawer',
  client,
  lang,
  under = true,
  titleTestID,
  testID = 'chat-header',
}: {
  /** The conversation's name - the chat's title, the room, the session. */
  title: string;
  /** What it is doing, or the model, under the name. */
  sub?: ReactNode;
  /** A small mark before the name (a room's icon). */
  icon?: ReactNode;
  /** Anything the bar holds on the left, after the drawer button (a spacer, mostly). */
  left?: ReactNode;
  /** The bar's own buttons on the right: closing it, or the chat's more and new. */
  right?: ReactNode;
  /** A row under the bar (a session's tags). */
  below?: ReactNode;
  wide?: boolean;
  onMenu?: () => void;
  menuLabel?: string;
  menuTestID?: string;
  client: WorkbenchClient | null;
  lang: VoiceLang;
  /** The conversation is scrolled under it: the bar takes its hairline. */
  under?: boolean;
  titleTestID?: string;
  testID?: string;
}) {
  const c = chromeStrings(uiLang(lang));
  const session = useMaybeSession();
  const reduce = useReduceMotion();
  /** The page in front, for what a screen reader reads: 0 the name, 1 the activity. */
  const [front, setFront] = useState(0);
  // The turn, as the worklets hold it: `from` is the page leaving, `to` the one coming in,
  // `dir` the side the leaving one goes to (+1 right), `p` 0 at the first and 1 at the second.
  const from = useSharedValue(0);
  const to = useSharedValue(0);
  /** The page in front once a turn has settled - where the next turn starts from. */
  const at = useSharedValue(0);
  const dir = useSharedValue(1);
  const p = useSharedValue(0);
  /** How far the name slides: the middle's own width. */
  const span = useSharedValue(0);
  /** How far the activity slides: the bar's whole width, which is what it covers. */
  const barW = useSharedValue(0);
  /** The finger turned the bar: the direction is known, so the drag is a turn and not a tap. */
  const turned = useSharedValue(0);

  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageX(0, from.get(), to.get(), dir.get(), p.get(), span.get()) }],
  }));
  const actStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageX(1, from.get(), to.get(), dir.get(), p.get(), barW.get()) }],
    // Nothing measured yet: the page covers the bar, and the name would be hidden behind it.
    opacity: barW.get() ? 1 : 0,
  }));

  /** Turn the bar by hand: the page in front leaves to the right, the other comes in. */
  const turn = useCallback(() => {
    // `front` and not `at`: the state is what the last turn left, and a tap is the only turn with no finger to follow.
    const here = front === 1 ? 1 : 0;
    from.set(here);
    to.set(1 - here);
    dir.set(1);
    p.set(0);
    p.set(reduce ? 1 : withTiming(1, { duration: motion.drawer, easing: Easing.out(Easing.cubic) }));
    at.set(1 - here);
    setFront(1 - here);
  }, [front, from, to, at, dir, p, reduce]);

  const pull = useContext(DrawerPull);
  const swipe = useMemo(() => {
    const g = Gesture.Pan()
      .activeOffsetX([-SLOP, SLOP])
      .failOffsetY([-14, 14])
      .onBegin(() => {
        'worklet';
        turned.set(0);
      })
      .onUpdate((e) => {
        'worklet';
        const dx = e.translationX;
        if (!turned.get()) {
          if (Math.abs(dx) < 2) return;
          const here = at.get();
          from.set(here);
          to.set(1 - here);
          dir.set(dx > 0 ? 1 : -1);
          p.set(0);
          turned.set(1);
        }
        // The wider of the two pages sets the pace: the activity travels the bar, so it follows the finger.
        const w = Math.max(span.get(), barW.get());
        if (w > 0) p.set(Math.min(1, Math.abs(dx) / w));
      })
      .onEnd((e) => {
        'worklet';
        if (!turned.get()) return;
        const go = p.get() >= HELD || Math.abs(e.velocityX) > FLICK;
        const still = reduce ? undefined : { duration: go ? motion.drawer : 150, easing: Easing.out(Easing.cubic) };
        p.set(reduce ? (go ? 1 : 0) : withTiming(go ? 1 : 0, still));
        if (go) at.set(to.get());
        scheduleOnRN(setFront, go ? to.get() : from.get());
      });
    return pull ? g.blocksExternalGesture(pull) : g;
  }, [pull, reduce, turned, from, to, at, dir, p, span, barW]);

  return (
    <View style={[s.root, under && s.rootUnder]} testID={testID}>
      <GestureDetector gesture={swipe}>
        <View style={s.head} onLayout={(e) => barW.set(e.nativeEvent.layout.width)}>
          {/* The name's half of the bar - everything the activity covers while it is in front. */}
          <View
            style={s.row}
            importantForAccessibility={front === 0 ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={front !== 0}
          >
            {!wide && onMenu ? (
              <IconButton icon={Menu} label={menuLabel} onPress={onMenu} testID={menuTestID} />
            ) : (
              <View style={s.side} />
            )}
            {left}
            <View style={s.mid} onLayout={(e) => span.set(e.nativeEvent.layout.width)}>
              <Reanimated.View
                style={[s.namePage, nameStyle]}
                pointerEvents={front === 0 ? 'auto' : 'none'}
                importantForAccessibility={front === 0 ? 'auto' : 'no-hide-descendants'}
                accessibilityElementsHidden={front !== 0}
              >
                <Pressable
                  onPress={turn}
                  hitSlop={9}
                  accessibilityRole="button"
                  accessibilityLabel={title}
                  accessibilityHint={c.titleHint}
                  accessibilityState={{ expanded: front === 1 }}
                  testID={titleTestID}
                  style={({ pressed }) => [s.titleRow, pressed && s.titlePressed]}
                >
                  {icon}
                  <Text style={s.title} numberOfLines={1} accessibilityRole="header">
                    {title}
                  </Text>
                </Pressable>
                {sub ? <View style={s.subRow}>{sub}</View> : null}
              </Reanimated.View>
            </View>
            {right ?? <View style={s.side} />}
          </View>
          {/* The activity is the bar's page and not the middle's: it comes in over the whole bar -
              the drawer button and the bar's own buttons under it - so every cell the person ticked
              in the sheet finds room there. */}
          <Reanimated.View
            style={[s.actPage, actStyle]}
            pointerEvents={front === 1 ? 'auto' : 'none'}
            importantForAccessibility={front === 1 ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={front !== 1}
            testID="activity-page"
          >
            {/* A tap beside the strip turns the name back: a screen reader cannot swipe the bar. */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={turn}
              accessibilityRole="button"
              accessibilityLabel={c.backToName}
              testID="activity-back"
            />
            <ActivityStrip client={client} scope={session?.account?.id ?? 'local'} lang={uiLang(lang)} brief />
          </Reanimated.View>
        </View>
      </GestureDetector>
      {below}
    </View>
  );
}

const s = StyleSheet.create({
  root: { borderBottomWidth: 1, borderBottomColor: 'transparent' },
  // Scrolled (or a session, which always keeps it): the hairline under the bar.
  rootUnder: { borderBottomColor: colors.line },
  head: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs + 2,
    // The activity page waits off the bar's side until it is turned in.
    overflow: 'hidden',
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  side: { width: touch, height: touch },
  // The two pages turn inside this, one in the flow (it is what sizes the bar) and one over it.
  mid: { flex: 1, minWidth: 0, overflow: 'hidden' },
  namePage: { alignItems: 'center', paddingVertical: space.xs },
  actPage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    // Opaque: it goes over the bar's own buttons while it is in front.
    backgroundColor: colors.surface,
  },
  titleRow: {
    maxWidth: '100%',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space.sm,
    borderRadius: space.sm,
  },
  titlePressed: { backgroundColor: colors.hover },
  title: { flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  subRow: { maxWidth: '100%', minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 1 },
});
