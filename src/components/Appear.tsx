/**
 * A screen or sheet coming in: a short fade with a small shift, transform and
 * opacity only (motion tokens), and nothing at all under reduced motion.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

import { motion } from '../theme/tokens';

export type From = 'right' | 'left' | 'below' | 'none';

const native = Platform.OS !== 'web';

export function Appear({
  from = 'none',
  fill = true,
  duration = motion.enter,
  style,
  children,
  testID,
}: {
  from?: From;
  /** Take the whole height (a screen), or only what the content needs (a sheet). */
  fill?: boolean;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
}) {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let live = true;
    const show = (still: boolean) => {
      if (!live) return;
      if (still) t.setValue(1);
      else
        Animated.timing(t, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    };
    const asked = AccessibilityInfo.isReduceMotionEnabled?.();
    if (asked) asked.then(show, () => show(false));
    else show(false);
    return () => {
      live = false;
      t.stopAnimation();
    };
  }, [t, duration]);

  const shift = t.interpolate({ inputRange: [0, 1], outputRange: [from === 'left' ? -motion.shift : motion.shift, 0] });
  const transform =
    from === 'right' || from === 'left'
      ? [{ translateX: shift }]
      : from === 'below'
        ? [{ translateY: shift }]
        : [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }];

  return (
    <Animated.View testID={testID} style={[fill && { flex: 1 }, { opacity: t, transform }, style]}>
      {children}
    </Animated.View>
  );
}
