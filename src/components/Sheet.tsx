/**
 * A sheet that rises from the bottom over a dimmed screen (mount it to open
 * it), a list of actions for one, and a small centred dialog. Back, or a tap
 * on the dimmed part, closes them.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, gutter, motion, radius, space, touch, type } from '../theme/tokens';
import { Appear } from './Appear';
import type { LucideIcon } from './icons';
import { KeyboardSpacer } from './KeyboardSpacer';
import { Button, ErrorText, Glyph } from './ui';

export function Sheet({
  onClose,
  title,
  children,
  testID,
}: {
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <Appear from="below" fill={false} duration={motion.sheet}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={s.sheet} testID={testID}>
          <View style={s.grip} aria-hidden />
          {title ? (
            <Text style={s.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {children}
          <KeyboardSpacer />
        </SafeAreaView>
      </Appear>
    </Modal>
  );
}

export interface Action {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onPress: () => void;
}

export function ActionList({ actions }: { actions: Action[] }) {
  return (
    <View style={s.actions}>
      {actions.map((a) => (
        <Pressable
          key={a.id}
          testID={`action-${a.id}`}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={s.action}
        >
          {({ pressed }) => {
            const ink = a.danger ? colors.danger : pressed ? colors.inkDim : colors.ink;
            return (
              <>
                <Glyph icon={a.icon} size={20} color={ink} />
                <Text style={[s.actionText, { color: ink }, pressed && a.danger && s.dangerPressed]}>{a.label}</Text>
              </>
            );
          }}
        </Pressable>
      ))}
    </View>
  );
}

/** A question in the middle of the screen, with its two ways out; the one that acts has the focus. */
export function Dialog({
  title,
  text,
  confirm,
  danger,
  input,
  onCancel,
  onConfirm,
}: {
  title: string;
  text?: string;
  confirm: string;
  danger?: boolean;
  /** Ask for a line of text (a new name) instead of a yes. */
  input?: { value: string; label: string };
  onCancel: () => void;
  onConfirm: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(input?.value ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<TextInput>(null);

  useEffect(() => {
    if (!input) return;
    const t = setTimeout(() => field.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [input]);

  const go = async () => {
    if (input && !value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(value.trim());
    } catch (e) {
      setError((e as Error).message || 'That did not work.');
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <View style={s.center}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cancel" />
        <Appear fill={false} duration={motion.sheet} style={s.dialogWrap}>
          <View style={s.dialog} accessibilityViewIsModal testID="dialog">
            <Text style={s.dialogTitle}>{title}</Text>
            {text ? <Text style={s.dialogText}>{text}</Text> : null}
            {input ? (
              <TextInput
                ref={field}
                testID="dialog-input"
                style={s.input}
                value={value}
                onChangeText={setValue}
                onSubmitEditing={go}
                accessibilityLabel={input.label}
                selectionColor={colors.inkDim}
                maxLength={120}
                returnKeyType="done"
                selectTextOnFocus
              />
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <View style={s.dialogRow}>
              <Button label="Cancel" variant="quiet" onPress={onCancel} />
              <Button
                testID="dialog-confirm"
                label={confirm}
                variant={danger ? 'danger' : 'primary'}
                busy={busy}
                disabled={!!input && !value.trim()}
                onPress={go}
              />
            </View>
          </View>
        </Appear>
        <KeyboardSpacer inset={0} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  grip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.pressed,
    marginBottom: space.sm,
  },
  title: {
    paddingHorizontal: gutter,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    fontFamily: fonts.sansSemi,
    fontSize: type.title,
    color: colors.ink,
  },
  actions: { paddingBottom: space.xs },
  action: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: gutter,
  },
  actionText: { fontFamily: fonts.sans, fontSize: type.body },
  dangerPressed: { opacity: 0.7 },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.scrim, paddingHorizontal: gutter + 8 },
  dialogWrap: { alignSelf: 'center', width: '100%', maxWidth: 420 },
  dialog: {
    backgroundColor: colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 12,
  },
  dialogTitle: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  dialogText: { fontFamily: fonts.sans, fontSize: type.small + 1, lineHeight: 21, color: colors.inkDim },
  input: {
    minHeight: touch,
    paddingHorizontal: 12,
    fontFamily: fonts.sans,
    fontSize: type.input,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  dialogRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: 4 },
});
