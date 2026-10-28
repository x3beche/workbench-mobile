/**
 * The bar every conversation is read under - Chat, one of the rooms, a Claude
 * session, an OpenCode session. One bar for all four, so they read as one
 * app: the drawer button on the left, the conversation's name in the middle
 * with what it is doing (or the model) under it, its own buttons on the
 * right (closing it, or the chat's more and new).
 *
 * Swiping the bar to the right pulls the account's live Activity strip
 * (components/Activity) down out of it, swiping left puts it back; a tap on
 * the name does the same, for whoever does not think of swiping. The strip
 * is shut until then, so the conversation keeps the screen.
 *
 * The swipe is a gesture-handler pan that blocks the drawer's own swipe to
 * the right (DrawerPull), which would otherwise pull the drawer out from
 * under the same finger.
 */
import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import type { VoiceLang, WorkbenchClient } from '../api/client';
import { useMaybeSession } from '../state/session';
import { colors, fonts, space, touch, type } from '../theme/tokens';
import { uiLang } from '../update/strings';
import { ActivityStrip } from './Activity';
import { DrawerPull } from './drawerGestures';
import { Menu } from './icons';
import { useReduceMotion } from './motion';
import { IconButton } from './ui';

/** How far the finger goes sideways before the bar is a swipe rather than a tap, and how far it must go to count. */
const SLOP = 16;
const DONE = 24;
const FLICK = 400;
/** The strip's own height plus the air under it; `maxHeight` so a strip with nothing to say takes no room. */
const STRIP_H = 34;

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
  /** A row under the bar and above the strip (a session's tags). */
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
  const session = useMaybeSession();
  const reduce = useReduceMotion();
  const [open, setOpen] = useState(false);
  const [v] = useState(() => new Animated.Value(0));

  const setStrip = useCallback(
    (on: boolean) => {
      setOpen(on);
      Animated.timing(v, {
        toValue: on ? 1 : 0,
        duration: reduce ? 0 : 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [v, reduce],
  );

  const pull = useContext(DrawerPull);
  const swipe = useMemo(() => {
    const g = Gesture.Pan()
      .activeOffsetX([-SLOP, SLOP])
      .failOffsetY([-14, 14])
      .onEnd((e) => {
        'worklet';
        if (e.translationX > DONE || e.velocityX > FLICK) scheduleOnRN(setStrip, true);
        else if (e.translationX < -DONE || e.velocityX < -FLICK) scheduleOnRN(setStrip, false);
      });
    return pull ? g.blocksExternalGesture(pull) : g;
  }, [pull, setStrip]);

  return (
    <View style={[s.root, under && s.rootUnder]} testID={testID}>
      <GestureDetector gesture={swipe}>
        <View style={s.head}>
          {!wide && onMenu ? (
            <IconButton icon={Menu} label={menuLabel} onPress={onMenu} testID={menuTestID} />
          ) : (
            <View style={s.side} />
          )}
          {left}
          <View style={s.mid}>
            <Pressable
              onPress={() => setStrip(!open)}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityHint="Swiping right shows this account's activity"
              accessibilityState={{ expanded: open }}
              testID={titleTestID}
              style={({ pressed }) => [s.titleRow, pressed && s.titlePressed]}
            >
              {icon}
              <Text style={s.title} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
            </Pressable>
            {sub ? <View style={s.subRow}>{sub}</View> : null}
          </View>
          {right ?? <View style={s.side} />}
        </View>
      </GestureDetector>
      {below}
      <Animated.View
        style={[
          s.strip,
          {
            maxHeight: v.interpolate({ inputRange: [0, 1], outputRange: [0, STRIP_H] }),
            opacity: v,
          },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!open}
        testID="activity-strip-wrap"
      >
        <ActivityStrip client={client} scope={session?.account?.id ?? 'local'} lang={uiLang(lang)} />
      </Animated.View>
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
  },
  side: { width: touch, height: touch },
  mid: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: space.xs },
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
  // A little air between the strip and the newest line above it; inside the box that folds away.
  strip: { overflow: 'hidden', paddingBottom: space.xs },
});
