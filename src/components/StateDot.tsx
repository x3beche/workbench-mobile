/**
 * The Orchestrator's small state dot, as the web app draws it (.orx-dot):
 * white and slowly breathing while it works, green when it waits or is done,
 * amber while it starts or retries, red when it failed, a hairline grey when
 * stopped. With reduced motion the dot does not breathe.
 *
 * One breath for every dot in the app: the web's is 1.8 s, opacity 1 to 0.2
 * and a small scale (frontend/styles.css `.wb-live`, app/live.ts). Here that
 * is one `Animated.Value` made once and shared, so two dots on the screen are
 * always in the same phase - a dot given its own loop started whenever its row
 * was drawn, and two rows side by side were in opposite halves of the breath.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import type { Dot } from '../lib/orchestrator';
import { colors } from '../theme/tokens';
import { useReduceMotion } from './motion';

const INK: Record<Dot, string> = {
  running: colors.accent,
  idle: colors.ok,
  done: colors.ok,
  retry: colors.warn,
  error: colors.danger,
  stopped: colors.pressed,
};

/** One breath, in milliseconds - the same number the web breathes at. */
export const LIVE_MS = 1800;

/** The breath itself: 1 at its brightest, 0 at its dimmest. Made once, for
 *  every dot in the app; it runs only while some dot is on the screen. */
const breath = new Animated.Value(1);
const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
let users = 0;
let loop: Animated.CompositeAnimation | null = null;

function acquire(): void {
  if (users++ > 0) return;
  loop = Animated.loop(
    Animated.sequence([
      Animated.timing(breath, {
        toValue: 0,
        duration: LIVE_MS / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(breath, {
        toValue: 1,
        duration: LIVE_MS / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]),
  );
  loop.start();
}

function release(): void {
  if (users === 0 || --users > 0) return;
  loop?.stop();
  loop = null;
  breath.setValue(1);
}

export function StateDot({ s, size = 7, testID, pulse: breathe }: { s: Dot; size?: number; testID?: string; pulse?: boolean }) {
  const reduce = useReduceMotion();
  const pulse = (s === 'running' || breathe) && !reduce;
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!pulse) return;
    acquire();
    setOn(true);
    return () => {
      setOn(false);
      release();
    };
  }, [pulse]);

  return (
    <Animated.View
      aria-hidden
      testID={testID}
      style={[
        s_.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: INK[s] },
        on ? { opacity, transform: [{ scale }] } : null,
      ]}
    />
  );
}

const s_ = StyleSheet.create({ dot: { flexShrink: 0 } });
