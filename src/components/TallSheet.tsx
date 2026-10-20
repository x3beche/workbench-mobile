/**
 * A tall sheet (most of the screen) with a title, a line under it and a
 * close button, for a list to search in: the MCP tools, the Orchestrator's
 * model. Mount it to open it; Back or a tap on the dimmed part closes it.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, gutter, motion, space, type } from '../theme/tokens';
import { Appear } from './Appear';
import { X } from './icons';
import { KeyboardSpacer } from './KeyboardSpacer';
import { IconButton } from './ui';

export function TallSheet({
  title,
  sub,
  closeLabel = 'Close',
  onClose,
  children,
  testID,
  height = 0.86,
}: {
  title: string;
  sub?: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
  /** The share of the screen's height it takes. */
  height?: number;
}) {
  const { height: h } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel={closeLabel} />
      <Appear from="below" fill={false} duration={motion.sheet}>
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={[s.sheet, { height: Math.round(h * height) }]}
          testID={testID}
        >
          <View style={s.grip} aria-hidden />
          <View style={s.head}>
            <View style={s.flex}>
              <Text style={s.title} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {sub ? (
                <Text style={s.sub} numberOfLines={2}>
                  {sub}
                </Text>
              ) : null}
            </View>
            <IconButton icon={X} label={closeLabel} onPress={onClose} color={colors.inkDim} testID={`${testID}-close`} />
          </View>
          <View style={s.flex}>{children}</View>
          <KeyboardSpacer />
        </SafeAreaView>
      </Appear>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  flex: { flex: 1, minWidth: 0 },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: space.sm,
  },
  grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.pressed },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: gutter,
    paddingRight: space.xs,
    paddingTop: space.xs,
    paddingBottom: space.xs,
  },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  sub: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim, marginTop: 2 },
});
