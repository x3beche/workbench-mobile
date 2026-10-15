/**
 * The room the keyboard takes, as a view at the bottom of a screen, so what
 * is above it (a list, the composer) is pushed up with the keyboard and stays
 * visible. It follows the keyboard frame by frame (react-native-keyboard-controller).
 *
 * The app draws edge to edge, so the window is never resized for the keyboard
 * (Android's adjustResize does nothing then): this view does it. The screen
 * already keeps the safe-area inset below it, which the keyboard covers too,
 * so that part is taken off.
 */
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function KeyboardSpacer({ inset }: { inset?: number }) {
  const { height } = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  const below = inset ?? insets.bottom;
  const style = useAnimatedStyle(() => ({ height: Math.max(-height.value - below, 0) }), [below]);
  return <Reanimated.View style={style} pointerEvents="none" />;
}
