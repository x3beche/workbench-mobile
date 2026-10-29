/**
 * One line about what just happened, over the bottom of the screen, gone by
 * itself: 2.2 seconds for news, 5 for what went wrong. The chat list and Files
 * each wrote this box and its clock; it is one box now, with one clock.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, fonts, motion, radius, space, type } from '../theme/tokens';
import { Appear } from './Appear';

export interface Said {
  text: string;
  bad?: boolean;
}

/** Say something for a moment; the box goes by itself. */
export function useToast(): { toast: Said | null; say: (text: string, bad?: boolean) => void } {
  const [toast, setToast] = useState<Said | null>(null);
  const say = useCallback((text: string, bad = false) => setToast({ text, bad }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.bad ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, say };
}

export function Toast({
  toast,
  bottom = space.md,
  testID,
}: {
  toast: Said | null;
  /** How far off the bottom it sits: over the composer on a conversation. */
  bottom?: number;
  testID?: string;
}) {
  if (!toast) return null;
  return (
    <Appear fill={false} from="below" duration={motion.fade} style={[s.wrap, { bottom }]}>
      <Text
        style={[s.box, toast.bad && s.bad]}
        accessibilityLiveRegion="polite"
        accessibilityRole={toast.bad ? 'alert' : 'text'}
        testID={testID}
      >
        {toast.text}
      </Text>
    </Appear>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center', maxWidth: '92%' },
  box: {
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface2,
    fontFamily: fonts.sansMedium,
    fontSize: type.small,
    color: colors.ink,
    textAlign: 'center',
  },
  bad: { color: colors.danger, borderRadius: radius.lg },
});
