/**
 * The few controls every screen uses, drawn the way the web app draws them
 * (styles.css: .tcv-btn, .tcv-btn-accent, .tcv-signin inputs): flat, a 1px
 * hairline, no shadows. Pressed states change the ground, never the size.
 */
import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, type } from '../theme/tokens';

type Variant = 'primary' | 'plain' | 'quiet' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'plain',
  disabled,
  busy,
  style,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && s.primary,
        variant === 'quiet' && s.quiet,
        variant === 'danger' && s.quiet,
        pressed && (variant === 'primary' ? s.primaryPressed : s.pressed),
        off && s.disabled,
        style,
      ]}
    >
      {({ pressed }) =>
        busy ? (
          <ActivityIndicator color={colors.inkDim} size="small" />
        ) : (
          <Text
            numberOfLines={1}
            style={[
              s.label,
              variant === 'quiet' && s.quietLabel,
              variant === 'danger' && s.dangerLabel,
              variant === 'primary' && pressed && s.primaryPressedLabel,
            ]}
          >
            {label}
          </Text>
        )
      }
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string; error?: boolean }>(function Field(
  { label, error, style, ...rest },
  ref,
) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.inkDim}
        selectionColor={colors.inkDim}
        accessibilityLabel={label}
        style={[s.input, error && s.inputError, style]}
        {...rest}
      />
    </View>
  );
});

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <View style={s.wordmark}>
      <Text style={s.brand} accessibilityRole="header">
        Workbench
      </Text>
      {sub ? <Text style={s.lead}>{sub}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <Text style={s.hint}>{children}</Text>;
}

const s = StyleSheet.create({
  btn: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  primary: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accent },
  primaryPressedLabel: { color: colors.inkOnAccent },
  quiet: { borderColor: 'transparent', backgroundColor: 'transparent', paddingHorizontal: 8 },
  pressed: { backgroundColor: colors.pressed },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  quietLabel: { color: colors.inkDim },
  dangerLabel: { color: colors.danger },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: type.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
  },
  inputError: { borderColor: colors.danger },
  wordmark: { gap: 6, marginBottom: 8 },
  brand: { fontFamily: fonts.sansSemi, fontSize: type.brand, letterSpacing: -0.3, color: colors.inkBright },
  lead: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 20, color: colors.inkDim },
  error: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 19, color: colors.danger },
  hint: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim },
});
