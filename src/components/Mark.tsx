/**
 * The Workbench section mark, the web app's favicon.svg path (the same one
 * scripts/make-icons.js draws the app icons from), as a vector in the ink.
 */
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

export const MARK_PATH = 'M12 12H52V52H12ZM17 17V30L30 17ZM17 47H23.5L47 23.5V17H40.5L17 40.5ZM34 47H47V34Z';

export function Mark({ size, color = colors.inkBright }: { size: number; color?: string }) {
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox="12 12 40 40">
        <Path d={MARK_PATH} fill={color} fillRule="evenodd" />
      </Svg>
    </View>
  );
}
