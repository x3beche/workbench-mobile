import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The person asked their device for less motion: the app then animates nothing. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
