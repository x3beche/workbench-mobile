/**
 * The Orchestrator's small state dot, as the web app draws it (.orx-dot):
 * white and slowly pulsing while it works, green when it waits or is done,
 * amber while it starts or retries, red when it failed, a hairline grey when
 * stopped. With reduced motion the dot does not pulse.
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

export function StateDot({ s, size = 7 }: { s: Dot; size?: number }) {
  const reduce = useReduceMotion();
  const [fade] = useState(() => new Animated.Value(1));
  const pulse = s === 'running' && !reduce;
  useEffect(() => {
    if (!pulse) {
      fade.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 0.35, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, fade]);
  return (
    <Animated.View
      aria-hidden
      style={[s_.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: INK[s], opacity: fade }]}
    />
  );
}

const s_ = StyleSheet.create({ dot: { flexShrink: 0 } });
