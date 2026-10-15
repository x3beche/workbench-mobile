/** Whether the system asks for reduced motion, kept up to date while the app runs. */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(
      (v) => live && setReduce(!!v),
      () => undefined,
    );
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduce(!!v));
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}
