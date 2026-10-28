/**
 * A row that a swipe to the left opens on its actions (Archive, Delete...),
 * drawn behind it at its right edge. A tap on an action closes the row and
 * does it; a tap on the row, or a swipe back, closes it. It follows the
 * finger and settles without overshoot; with reduced motion it does not
 * glide (react-native-gesture-handler's ReanimatedSwipeable).
 *
 * Inside the drawer the row's swipe wins over the drawer's own swipe to the
 * left (DrawerGesture): a swipe on a row opens it, anywhere else shuts the
 * drawer.
 */
import { useContext, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { colors, fonts, type } from '../theme/tokens';
import { DrawerGesture } from './drawerGestures';
import type { LucideIcon } from './icons';
import { Glyph } from './ui';

export { DrawerGesture };

export interface SwipeAction {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onPress: () => void;
}

const WIDTH = 76;

export function SwipeRow({
  actions,
  children,
  testID,
}: {
  actions: SwipeAction[];
  children: ReactNode;
  testID?: string;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const outer = useContext(DrawerGesture);
  if (!actions.length) return <>{children}</>;
  return (
    <Swipeable
      ref={ref}
      testID={testID}
      friction={1}
      rightThreshold={WIDTH * 0.6}
      overshootRight={false}
      dragOffsetFromRightEdge={12}
      blocksExternalGesture={outer}
      containerStyle={s.container}
      renderRightActions={() => (
        <View style={[s.actions, { width: WIDTH * actions.length }]}>
          {actions.map((a) => (
            <Pressable
              key={a.id}
              testID={testID ? `${testID}-${a.id}` : undefined}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                ref.current?.close();
                a.onPress();
              }}
              style={({ pressed }) => [s.action, a.danger ? s.danger : s.plain, pressed && s.pressed]}
            >
              <Glyph icon={a.icon} size={20} color={a.danger ? colors.inkBright : colors.ink} />
              <Text style={[s.label, a.danger && s.labelDanger]} numberOfLines={1}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: colors.surface },
  actions: { flexDirection: 'row' },
  action: { width: WIDTH, alignItems: 'center', justifyContent: 'center', gap: 3 },
  plain: { backgroundColor: colors.hover },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.ink },
  labelDanger: { color: colors.inkBright },
});
