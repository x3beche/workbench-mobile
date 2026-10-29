/**
 * The conversations drawer: a panel that slides in from the left over the
 * conversation, which dims behind it.
 *
 * It follows the finger: a swipe to the right on the conversation pulls it
 * out, a swipe to the left (or a tap on the dimmed side, or Back) puts it
 * away; let go and it springs open or shut by where it is and how fast it
 * was going. Only transform and opacity move, on the UI thread
 * (react-native-reanimated, react-native-gesture-handler). With reduced
 * motion it still follows the finger but opens and closes without moving.
 *
 * On a wide screen (`wide`) the panel is a side column that stays open.
 * A row that opens on a swipe (SwipeRow) takes the swipe to the left first.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, motion } from '../theme/tokens';
import { useReduceMotion } from './motion';
import { DrawerGesture, DrawerPull } from './drawerGestures';

/** How far the finger must go sideways before the drawer follows it (and how far up or down before it never does). */
const SLOP_X = 14;
const SLOP_Y = 12;
/** A flick at least this fast (px/s) opens or closes it whatever its position. */
const FLICK = 500;

/** Pans only where a finger moves things: a phone or a touch screen, not a mouse selecting text. */
const touchable =
  Platform.OS !== 'web' || (typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);

export function Drawer({
  open,
  onOpenChange,
  width,
  wide,
  panel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: number;
  wide: boolean;
  panel: ReactNode;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  // 0 shut, 1 open.
  const p = useSharedValue(open ? 1 : 0);
  // The drawer was let go by the finger: it is already springing to where it settles.
  const byHand = useSharedValue(false);

  useEffect(() => {
    if (byHand.get()) {
      byHand.set(false);
      return;
    }
    const to = open ? 1 : 0;
    p.set(reduce ? to : withTiming(to, { duration: motion.drawer, easing: Easing.out(Easing.cubic) }));
  }, [open, reduce, p, byHand]);

  const gestures = useMemo(() => {
    const release = (velocity: number) => {
      'worklet';
      const to = velocity > FLICK ? 1 : velocity < -FLICK ? 0 : p.get() > 0.4 ? 1 : 0;
      if ((to === 1) === open) return void p.set(reduce ? to : withTiming(to, { duration: motion.drawer }));
      byHand.set(true);
      p.set(
        reduce
          ? to
          : withSpring(to, {
              damping: 30,
              stiffness: 320,
              mass: 1,
              overshootClamping: true,
              velocity: velocity / width,
            }),
      );
      scheduleOnRN(onOpenChange, to === 1);
    };
    const pull = Gesture.Pan()
      .enabled(!open && !wide && touchable)
      .activeOffsetX(SLOP_X)
      .failOffsetY([-SLOP_Y, SLOP_Y])
      .onUpdate((e) => {
        p.set(Math.min(1, Math.max(0, (e.translationX - SLOP_X) / width)));
      })
      .onEnd((e) => release(e.velocityX));
    const push = Gesture.Pan()
      .enabled(open && !wide && touchable)
      .activeOffsetX(-SLOP_X)
      .failOffsetY([-SLOP_Y, SLOP_Y])
      .onUpdate((e) => {
        p.set(Math.min(1, Math.max(0, 1 + (e.translationX + SLOP_X) / width)));
      })
      .onEnd((e) => release(e.velocityX));
    return { pull, push };
  }, [open, wide, width, reduce, p, byHand, onOpenChange]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (p.value - 1) * width }] }));
  // The rows come in a little behind the panel's edge, so the list settles rather than snaps.
  const innerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.6, 1], [0, 0.85, 1]),
    transform: [{ translateX: interpolate(p.value, [0, 1], [-16, 0]) }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: p.value * 0.8 }));

  // A shut drawer is out of the finger's way, and out of the keyboard's: on the
  // web a panel that is only slid aside still takes every Tab stop (the search
  // field, forty rows, the account), so the conversation behind it cannot be
  // reached at all. Once it has finished sliding it leaves the layout, and comes
  // back for the slide in.
  // Where the slide has settled: shut, and the panel is out of the layout; open,
  // and it is back in it (nothing is drawn through the middle of the slide).
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    const t = setTimeout(() => setSettled(open), open || reduce ? 0 : motion.drawer + 80);
    return () => clearTimeout(t);
  }, [open, reduce]);
  const gone = !open && !settled;

  if (wide) {
    return (
      <View style={s.row}>
        <View style={[s.column, { width }]} testID="drawer" accessibilityLabel="Conversations">
          {panel}
        </View>
        <View style={s.flex}>{children}</View>
      </View>
    );
  }

  return (
    <View style={s.flex}>
      <DrawerPull.Provider value={gestures.pull}>
        <GestureDetector gesture={gestures.pull}>
          <View style={s.flex} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
            {children}
          </View>
        </GestureDetector>
      </DrawerPull.Provider>
      <GestureDetector gesture={gestures.push}>
        <View
          style={[StyleSheet.absoluteFill, gone && s.gone]}
          pointerEvents="box-none"
          testID="drawer-overlay"
        >
          <Reanimated.View style={[StyleSheet.absoluteFill, s.dim, dimStyle]} pointerEvents={open ? 'auto' : 'none'}>
            <Pressable
              style={s.flex}
              onPress={() => onOpenChange(false)}
              accessibilityRole="button"
              accessibilityLabel="Close the conversations"
              testID="drawer-scrim"
            />
          </Reanimated.View>
          <Reanimated.View
            style={[s.panel, { width }, panelStyle]}
            pointerEvents={open ? 'auto' : 'none'}
            testID="drawer"
            accessibilityViewIsModal={open}
            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={!open}
          >
            <Reanimated.View style={[s.flex, innerStyle]}>
              {/* A swipe on a row opens the row's buttons rather than shutting the drawer. */}
              <DrawerGesture.Provider value={gestures.push}>{panel}</DrawerGesture.Provider>
            </Reanimated.View>
          </Reanimated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  column: { borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.surface },
  dim: { backgroundColor: colors.scrim },
  gone: { display: 'none' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
});
