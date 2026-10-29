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
  Platform,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, gutter, motion, radius, space, touch, type } from '../theme/tokens';
import { Appear } from './Appear';
import type { LucideIcon } from './icons';
import { Mark } from './Mark';

/** IBM Plex Sans caps stand at 0.698 em; the web wordmark draws its mark at about 1.1 cap heights. */
const MARK_SIZE = Math.round(type.brand * 0.698 * 1.1);

/**
 * A screen with nothing in it yet: the mark of the thing it will hold, what it
 * is, and why it is empty. Never a blank page - and never a spinner left
 * turning where nothing will come.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
  testID,
}: {
  icon?: LucideIcon;
  title: string;
  text?: string;
  /** What the person can do about it, if anything. */
  action?: ReactNode;
  testID?: string;
}) {
  return (
    <Appear fill duration={motion.enter}>
      <View style={s.empty} testID={testID}>
        {icon ? <Glyph icon={icon} size={28} color={colors.inkDim} /> : null}
        <Text style={s.emptyTitle}>{title}</Text>
        {text ? <Text style={s.emptyLead}>{text}</Text> : null}
        {action ?? null}
      </View>
    </Appear>
  );
}

/** A long word or address breaks inside its column instead of running off the screen (native text does this already). */
export const wrapAnywhere: TextStyle = Platform.OS === 'web' ? ({ wordBreak: 'break-word' } as TextStyle) : {};

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
      hitSlop={4}
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

/** One of the app's line icons (components/icons.ts) at the app's stroke and ink. */
export function Glyph({ icon: I, size = 20, color = colors.ink }: { icon: LucideIcon; size?: number; color?: string }) {
  return <I size={size} color={color} strokeWidth={1.75} aria-hidden />;
}

/**
 * A control that is only an icon: 44 px to touch, no box; pressing it shows
 * a soft round ground under the icon for as long as the finger is down.
 */
export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  size = 22,
  color = colors.ink,
  disabled,
  testID,
  style,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      style={({ pressed }) => [s.iconBtn, pressed && s.iconPressed, disabled && s.disabled, style]}
    >
      <Glyph icon={icon} size={size} color={color} />
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
      <View style={s.brandRow} testID="wordmark">
        <Mark size={MARK_SIZE} />
        <Text style={s.brand} accessibilityRole="header">
          Workbench
        </Text>
      </View>
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

/**
 * What could not be read, and the one thing to do about it.
 *
 * Every screen that reads something of the server says it the same way: the
 * reason in the words the server or the app has, and Try again beside it - so
 * "could not load" is never a dead end that needs the app restarted. A screen
 * with nothing to show yet centres it; one that already has lines puts it in
 * the strip above the box.
 */
export function LoadError({
  text,
  onRetry,
  retryLabel = 'Try again',
  centered = false,
  testID = 'load-error',
}: {
  text: string;
  onRetry: () => void;
  retryLabel?: string;
  centered?: boolean;
  testID?: string;
}) {
  return (
    <View style={[s.loadError, centered && s.loadErrorCentered]} testID={testID}>
      <ErrorText>{text}</ErrorText>
      <Button label={retryLabel} variant="quiet" onPress={onRetry} testID={`${testID}-retry`} />
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: touch,
    minWidth: touch,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    // A control's edge: 3:1 against its ground, so the button is a button.
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  primary: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accent },
  primaryPressedLabel: { color: colors.inkOnAccent },
  quiet: { borderColor: 'transparent', backgroundColor: 'transparent', paddingHorizontal: 8 },
  pressed: { backgroundColor: colors.pressed },
  disabled: { opacity: 0.45 },
  iconBtn: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center' },
  iconPressed: { backgroundColor: colors.hover },
  label: { fontFamily: fonts.sansMedium, fontSize: type.lead, color: colors.ink },
  quietLabel: { color: colors.inkDim },
  dangerLabel: { color: colors.danger },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: type.input,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
  },
  inputError: { borderColor: colors.danger },
  wordmark: { gap: 6, marginBottom: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontFamily: fonts.sansSemi, fontSize: type.brand, letterSpacing: -0.3, color: colors.inkBright },
  lead: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.inkDim },
  error: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.danger },
  hint: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.inkDim },
  empty: { paddingHorizontal: gutter, paddingVertical: space.xxl, gap: 8, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright, textAlign: 'center' },
  emptyLead: {
    maxWidth: 420,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
    textAlign: 'center',
  },
  loadError: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  loadErrorCentered: { flex: 1, flexDirection: 'column', paddingVertical: 32, gap: 8 },
});
